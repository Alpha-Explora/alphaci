#!/usr/bin/env bash
# Bound addresses (IIS-style bindings). An assignment in `bound` ingress mode is
# served under the customer's own hostname on port 443, optionally on one local
# IP, with an uploaded certificate, an automatic ACME certificate, or Caddy's
# internal CA. Sourced by alphaci-supervisor, which sets API and WORK (holding
# auth.header) before it calls binding_sync with the heartbeat reply.
#
# Each binding has $ROOT/bindings/<environment>/, root-owned and 0755:
#   binding.json         the order from the heartbeat reply
#   cert.pem, key.pem    the uploaded certificate (0644) and its key (0600)
#   cert.sha256          the certificate version held, as AlphaCI names it
#   site.caddy           the Caddy site; present only while it can be served
#   served.sha256        the site files the running proxy last loaded
#   binding-report.json  what this machine observed; the next heartbeat sends it
#
# Two edge modes. On the self-hosted AlphaCI server, where alphaci-ctl
# server-host writes "appliance" to $ROOT/edge-mode, the server's own Caddy
# imports the sites and alphaci-app-routes reloads it; this agent only writes
# files. On any other machine this agent runs one Caddy container,
# alphaci-edge, on the host network.

BINDING_HOME="${ALPHACI_HOME:-/opt/alphaci}"
BINDING_ROOT="$BINDING_HOME/bindings"
BINDING_EDGE_DIR="$BINDING_HOME/edge"
BINDING_EDGE_CONTAINER=alphaci-edge
BINDING_EDGE_DEFAULT_IMAGE=caddy:2-alpine
BINDING_UUID='^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
# Per cycle: environment -> assignment of each site the edge must serve, and a
# problem to report even though the site is served (a certificate kept).
declare -A BINDING_ACTIVE=()
declare -A BINDING_NOTE=()
BINDING_KEEP=" "
BINDING_SEEN=" "

# binding_edge_mode: "appliance" on the AlphaCI server, "standalone" anywhere else.
binding_edge_mode() {
  local file="$BINDING_HOME/edge-mode" mode=""
  if [ -f "$file" ] && [ ! -L "$file" ]; then
    mode=$(head -n 1 "$file" 2> /dev/null | tr -d '[:space:]' || true)
  fi
  if [ "$mode" = appliance ]; then echo appliance; else echo standalone; fi
}

# binding_edge_image: the proxy image, ALPHACI_EDGE_IMAGE from the environment
# or from $ROOT/agent.env (read, never sourced), caddy:2-alpine otherwise.
binding_edge_image() {
  local image="${ALPHACI_EDGE_IMAGE:-}"
  if [ -z "$image" ] && [ -f "$BINDING_HOME/agent.env" ] && [ ! -L "$BINDING_HOME/agent.env" ]; then
    image=$(sed -n 's/^ALPHACI_EDGE_IMAGE=//p' "$BINDING_HOME/agent.env" | tr -d "\"' \r" | tail -n 1)
  fi
  if [[ "$image" =~ ^[A-Za-z0-9][A-Za-z0-9._/:-]{0,254}(@sha256:[0-9a-f]{64})?$ ]]; then
    printf '%s\n' "$image"
  else
    printf '%s\n' "$BINDING_EDGE_DEFAULT_IMAGE"
  fi
}

# binding_hostname_valid <name>: a lowercase DNS name whose last label starts
# with a letter, so an IP address is never taken for a name.
binding_hostname_valid() {
  [ "${#1}" -le 253 ] &&
    [[ "$1" =~ ^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z]([a-z0-9-]{0,61}[a-z0-9])?$ ]]
}

# binding_address_valid <address>: an IPv4 literal, or an IPv6 literal in
# lowercase hex without a zone or an embedded IPv4 part.
binding_address_valid() {
  local address="$1" octet='(25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])' marked doubles group groups=0
  [[ "$address" =~ ^$octet(\.$octet){3}$ ]] && return 0
  [[ "$address" =~ ^[0-9a-f:]{2,39}$ && "$address" != *:::* ]] || return 1
  marked="${address//::/#}"
  doubles="${marked//[^#]/}"
  [ "${#doubles}" -le 1 ] || return 1
  [[ "$marked" != :* && "$marked" != *: ]] || return 1
  for group in ${marked//[:#]/ }; do
    [[ "$group" =~ ^[0-9a-f]{1,4}$ ]] || return 1
    groups=$((groups + 1))
  done
  if [ "${#doubles}" -eq 1 ]; then [ "$groups" -le 7 ]; else [ "$groups" -eq 8 ]; fi
}

# binding_address_local <address>: the address is configured on an interface here.
binding_address_local() {
  ip -o addr show 2> /dev/null < /dev/null | awk '{print $4}' | cut -d/ -f1 | grep -qxF -- "$1"
}

# binding_port_taken <address> <port>: something listens on the port where the
# proxy would. An empty address means every address.
binding_port_taken() {
  local listen="$1" local_address host
  while read -r _ _ _ local_address _; do
    host="${local_address%:*}"; host="${host#[}"; host="${host%]}"; host="${host%%%*}"
    case "$host" in '*' | 0.0.0.0 | ::) return 0 ;; esac
    if [ -z "$listen" ] || [ "$host" = "$listen" ]; then return 0; fi
  done < <(ss -H -ltn "sport = :$2" 2> /dev/null < /dev/null || true)
  return 1
}

# binding_regular <path>: a regular file, never a link.
binding_regular() { [ -f "$1" ] && [ ! -L "$1" ]; }

# binding_put <dir> <name> <mode> <source>: writes the file under a fresh name
# and renames it into place, so a link there is replaced, never followed.
binding_put() {
  local tmp
  if binding_regular "$1/$2" && cmp -s "$4" "$1/$2"; then
    chmod "$3" "$1/$2"
    return 0
  fi
  tmp=$(mktemp "$1/.$2.XXXXXX")
  cat "$4" > "$tmp"
  chmod "$3" "$tmp"
  mv -fT "$tmp" "$1/$2"
}

# binding_report <environment> <assignment-id> <status> <message>
binding_report() {
  local tmp
  tmp=$(mktemp "$WORK/binding-report.XXXXXX")
  jq -n --arg assignmentId "$2" --arg status "$3" --arg message "$4" \
    '{assignmentId: $assignmentId, status: $status, message: ($message | .[0:300])}' > "$tmp"
  binding_put "$BINDING_ROOT/$1" binding-report.json 0644 "$tmp"
  rm -f "$tmp"
}

# binding_withdraw <environment> <assignment-id> <status> <message>: reports the
# binding and takes its site out of the proxy's configuration.
binding_withdraw() {
  rm -f "$BINDING_ROOT/$1/site.caddy" "$BINDING_ROOT/$1/served.sha256"
  unset 'BINDING_ACTIVE[$1]'
  binding_report "$@"
}

# binding_pair_matches <cert> <key>: the certificate parses and the key is its own.
binding_pair_matches() {
  openssl x509 -in "$1" -noout -pubkey > "$1.pub" 2> /dev/null < /dev/null &&
    openssl pkey -pubin -in "$1.pub" -outform DER -out "$1.der" 2> /dev/null < /dev/null &&
    openssl pkey -in "$2" -passin pass: -pubout -outform DER -out "$2.der" 2> /dev/null < /dev/null &&
    [ -s "$1.der" ] && cmp -s "$1.der" "$2.der"
}

# binding_certificate <environment> <certificate-id> <sha256>: makes sure the
# uploaded certificate is held, downloading it only when the version AlphaCI
# names differs from the one held. Sets BINDING_CERT_PROBLEM when it could not
# be updated, and fails when no certificate can be served at all.
binding_certificate() {
  local dir="$BINDING_ROOT/$1" fetched="$WORK/certificate-$1" code held=""
  BINDING_CERT_PROBLEM=""
  binding_regular "$dir/cert.sha256" && held=$(head -c 64 "$dir/cert.sha256")
  if [ "$held" = "$3" ] && binding_regular "$dir/cert.pem" && binding_regular "$dir/key.pem"; then
    return 0
  fi
  code=$(curl -sS --max-time 30 -H "@$WORK/auth.header" -o "$fetched.json" -w '%{http_code}' \
    "$API/api/v1/onprem/certificates/$2" 2> /dev/null < /dev/null) || code=000
  if [ "$code" != 200 ]; then
    BINDING_CERT_PROBLEM="The certificate could not be downloaded from AlphaCI (HTTP $code)."
  elif ! jq -e --arg id "$2" --arg sha "$3" '.id == $id and .sha256 == $sha and
      (.certificatePem | type == "string") and (.privateKeyPem | type == "string")' "$fetched.json" > /dev/null 2>&1; then
    BINDING_CERT_PROBLEM='AlphaCI sent a different certificate from the one this binding names, so it was not installed.'
  else
    jq -j '.certificatePem' "$fetched.json" > "$fetched.cert"
    jq -j '.privateKeyPem' "$fetched.json" > "$fetched.key"
    if binding_pair_matches "$fetched.cert" "$fetched.key"; then
      # The key goes in before the certificate, and the version last.
      binding_put "$dir" key.pem 0600 "$fetched.key"
      binding_put "$dir" cert.pem 0644 "$fetched.cert"
      printf '%s\n' "$3" > "$fetched.sha256"
      binding_put "$dir" cert.sha256 0644 "$fetched.sha256"
      rm -f "$fetched".*
      return 0
    fi
    BINDING_CERT_PROBLEM='The certificate AlphaCI sent does not parse or does not match its private key, so it was not installed.'
  fi
  rm -f "$fetched".*
  if binding_regular "$dir/cert.pem" && binding_regular "$dir/key.pem"; then
    BINDING_CERT_PROBLEM="$BINDING_CERT_PROBLEM The previous certificate is still served."
    return 0
  fi
  return 1
}

# binding_sync_one <mode> <order JSON>: writes one binding's files, or reports
# why it cannot be served here.
binding_sync_one() {
  local mode="$1" fields id project environment port hostname listen kind certificate sha dir site
  mapfile -t fields < <(jq -r '(.tls | if type == "object" then . else {} end) as $t |
    [.assignmentId, .projectId, .environmentId, .hostPort, .hostname, .listenAddress,
     $t.kind, $t.certificateId, $t.sha256] | .[] |
    if . == null then "" else tostring | gsub("[[:cntrl:]]"; "?") end' <<< "$2" 2> /dev/null || true)
  [ "${#fields[@]}" -eq 9 ] || return 0
  id="${fields[0]}"; project="${fields[1]}"; environment="${fields[2]}"; port="${fields[3]}"
  hostname="${fields[4]}"; listen="${fields[5],,}"; kind="${fields[6]}"
  certificate="${fields[7]}"; sha="${fields[8]}"
  # Without valid ids there is no folder to write and no assignment to report on.
  [[ "$environment" =~ $BINDING_UUID && "$id" =~ $BINDING_UUID ]] || return 0
  case "$BINDING_SEEN" in *" $environment "*) return 0 ;; esac
  BINDING_SEEN="$BINDING_SEEN$environment "
  BINDING_KEEP="$BINDING_KEEP$environment "
  dir="$BINDING_ROOT/$environment"
  install -d -m 0755 "$BINDING_ROOT"
  [ ! -L "$dir" ] || rm -f "$dir"
  install -d -m 0755 "$dir"
  chown root:root "$dir" 2> /dev/null || true
  printf '%s\n' "$2" > "$WORK/binding.json"
  binding_put "$dir" binding.json 0644 "$WORK/binding.json"
  # Checked again here: nothing unvalidated is ever written into Caddy's configuration.
  if ! [[ "$project" =~ $BINDING_UUID ]]; then
    binding_withdraw "$environment" "$id" failed 'The binding AlphaCI sent has an invalid project id, so this machine did not serve it.'
    return 0
  fi
  if ! [[ "$port" =~ ^[1-9][0-9]{0,4}$ ]] || [ "$port" -gt 65535 ]; then
    binding_withdraw "$environment" "$id" failed 'The binding AlphaCI sent has an invalid host port, so this machine did not serve it.'
    return 0
  fi
  if ! binding_hostname_valid "$hostname"; then
    binding_withdraw "$environment" "$id" failed 'The binding AlphaCI sent has an invalid hostname (a lowercase DNS name is required), so this machine did not serve it.'
    return 0
  fi
  if [ -n "$listen" ] && ! binding_address_valid "$listen"; then
    binding_withdraw "$environment" "$id" failed 'The binding AlphaCI sent has an invalid listen address (an IPv4 or IPv6 address is required), so this machine did not serve it.'
    return 0
  fi
  case "$kind" in
    acme | internal) ;;
    certificate)
      if ! [[ "$certificate" =~ $BINDING_UUID && "$sha" =~ ^[0-9a-f]{64}$ ]]; then
        binding_withdraw "$environment" "$id" failed 'The binding AlphaCI sent names an invalid certificate, so this machine did not serve it.'
        return 0
      fi ;;
    *)
      binding_withdraw "$environment" "$id" failed 'The binding AlphaCI sent has an unknown certificate kind, so this machine did not serve it.'
      return 0 ;;
  esac
  case "$BINDING_SEEN" in
    *" site:$hostname@$listen "*)
      binding_withdraw "$environment" "$id" failed "Another environment on this machine already serves $hostname${listen:+ on $listen}, so this one was not served."
      return 0 ;;
  esac
  BINDING_SEEN="${BINDING_SEEN}site:$hostname@$listen "
  if [ -n "$listen" ] && [ "$mode" = appliance ]; then
    binding_withdraw "$environment" "$id" failed "This machine is the AlphaCI server, whose proxy listens on every address, so it cannot serve this address on $listen alone. Clear the listen address."
    return 0
  fi
  if [ -n "$listen" ] && ! binding_address_local "$listen"; then
    binding_withdraw "$environment" "$id" failed "$listen is not an address of this machine. Add it to a network interface here, or change the listen address."
    return 0
  fi
  if [ "$kind" = certificate ]; then
    rm -f "$dir/cert.pem.pub" "$dir/cert.pem.der" "$dir/key.pem.der"
    if ! binding_certificate "$environment" "$certificate" "$sha"; then
      binding_withdraw "$environment" "$id" failed "$BINDING_CERT_PROBLEM"
      return 0
    fi
    [ -z "$BINDING_CERT_PROBLEM" ] || BINDING_NOTE[$environment]="$BINDING_CERT_PROBLEM"
  else
    # A certificate from an earlier order is not kept around.
    rm -f "$dir/cert.pem" "$dir/key.pem" "$dir/cert.sha256"
  fi
  site="$WORK/site.caddy"
  {
    printf '# Written by the AlphaCI agent for environment %s. Changes are overwritten.\n' "$environment"
    printf '%s {\n' "$hostname"
    [ -z "$listen" ] || printf '\tbind %s\n' "$listen"
    case "$kind" in
      certificate) printf '\ttls /bindings/%s/cert.pem /bindings/%s/key.pem\n' "$environment" "$environment" ;;
      internal) printf '\ttls internal\n' ;;
    esac
    # Caddy reads the upstream host from the environment of the proxy that imports this.
    # shellcheck disable=SC2016
    printf '\tencode zstd gzip\n\treverse_proxy {$ALPHACI_APP_UPSTREAM}:%s\n}\n' "$port"
  } > "$site"
  binding_put "$dir" site.caddy 0644 "$site"
  BINDING_ACTIVE[$environment]="$id"
}

# binding_site_hash <environment>: the site's files as the proxy would load them.
binding_site_hash() {
  local dir="$BINDING_ROOT/$1" name
  for name in site.caddy cert.pem key.pem; do
    if binding_regular "$dir/$name"; then printf '%s\n' "$name"; cat "$dir/$name"; fi
  done | sha256sum | cut -c1-64
}

# binding_caddy_error <file>: the last error Caddy or Docker printed, in one line.
binding_caddy_error() {
  local line
  line=$(grep -aiE 'error|refused|denied|in use|invalid' "$1" 2> /dev/null | tail -n 1 || true)
  [ -n "$line" ] || line=$(tail -n 1 "$1" 2> /dev/null || true)
  line=$(jq -r '.error // .msg // empty' <<< "$line" 2> /dev/null || printf '%s' "$line")
  printf '%s' "$line" | tr -d '\000-\037' | head -c 180
}

# binding_report_active <status> <message>: reports every site the edge serves.
# A site with a note (an update that failed) reports the note instead.
binding_report_active() {
  local environment
  for environment in "${!BINDING_ACTIVE[@]}"; do
    if [ -n "${BINDING_NOTE[$environment]:-}" ] && [ "$1" != failed ] && [ "$1" != unavailable ]; then
      binding_report "$environment" "${BINDING_ACTIVE[$environment]}" failed "${BINDING_NOTE[$environment]}"
    else
      binding_report "$environment" "${BINDING_ACTIVE[$environment]}" "$1" "$2"
    fi
  done
}

# binding_mark_served: records the files the running proxy loaded.
binding_mark_served() {
  local environment
  for environment in "${!BINDING_ACTIVE[@]}"; do
    binding_site_hash "$environment" > "$WORK/served.sha256"
    binding_put "$BINDING_ROOT/$environment" served.sha256 0644 "$WORK/served.sha256"
  done
  printf '%s\n' "$1" > "$WORK/edge-served.sha256"
  binding_put "$BINDING_EDGE_DIR" served.sha256 0600 "$WORK/edge-served.sha256"
}

# binding_edge_stop: removes the standalone proxy. Its ACME volume stays, so a
# later start does not request every certificate again.
binding_edge_stop() {
  if docker inspect "$BINDING_EDGE_CONTAINER" > /dev/null 2>&1 < /dev/null; then
    docker rm -f "$BINDING_EDGE_CONTAINER" > /dev/null 2>&1 < /dev/null || true
  fi
  rm -f "$BINDING_EDGE_DIR/served.sha256"
}

# binding_edge_sync: keeps the standalone proxy serving exactly the sites written
# this cycle, and reports each one.
binding_edge_sync() {
  local image state status running=0 environment desired served previous log="$WORK/edge.log" listen
  if [ "${#BINDING_ACTIVE[@]}" -eq 0 ]; then binding_edge_stop; return 0; fi
  if ! docker info > /dev/null 2>&1 < /dev/null; then
    binding_report_active unavailable 'Docker is not running, so this machine cannot run the proxy that serves this address.'
    return 0
  fi
  image=$(binding_edge_image)
  state=$(docker inspect -f '{{.State.Status}} {{.Config.Image}}' "$BINDING_EDGE_CONTAINER" 2> /dev/null < /dev/null || true)
  status="${state%% *}"
  if [ "$status" = running ] && [ "${state#* }" = "$image" ]; then running=1; fi
  if [ "$running" = 0 ]; then
    # Nothing of ours listens yet, so a listener on 443 or 80 is another program.
    for environment in "${!BINDING_ACTIVE[@]}"; do
      listen=$(jq -r '.listenAddress // "" | ascii_downcase' "$BINDING_ROOT/$environment/binding.json" 2> /dev/null || true)
      for port in 443 80; do
        if binding_port_taken "$listen" "$port"; then
          binding_withdraw "$environment" "${BINDING_ACTIVE[$environment]}" failed \
            "Port $port on ${listen:-every address} is used by another program, so this address cannot be served. Stop that program or choose another listen address."
          break
        fi
      done
    done
    if [ "${#BINDING_ACTIVE[@]}" -eq 0 ]; then binding_edge_stop; return 0; fi
  fi
  install -d -m 0755 "$BINDING_EDGE_DIR"
  # The admin API listens on a socket inside the container only: on the host
  # network a TCP admin port would let any local user reconfigure the proxy.
  printf '{\n\tadmin unix//run/alphaci-edge/admin.sock\n}\n\nimport /bindings/*/site.caddy\n' > "$WORK/Caddyfile"
  binding_put "$BINDING_EDGE_DIR" Caddyfile 0644 "$WORK/Caddyfile"
  desired=$({
    printf '%s\n' "$image"
    cat "$BINDING_EDGE_DIR/Caddyfile"
    for environment in "${!BINDING_ACTIVE[@]}"; do
      printf '%s %s\n' "$environment" "$(binding_site_hash "$environment")"
    done | sort
  } | sha256sum | cut -c1-64)
  served=""
  binding_regular "$BINDING_EDGE_DIR/served.sha256" && served=$(head -c 64 "$BINDING_EDGE_DIR/served.sha256")
  if [ "$running" = 1 ] && [ "$desired" = "$served" ]; then
    binding_report_active running 'The proxy on this machine serves this address.'
    return 0
  fi
  if [ "$running" = 1 ]; then
    if docker exec "$BINDING_EDGE_CONTAINER" caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile > "$log" 2>&1 < /dev/null &&
      docker exec "$BINDING_EDGE_CONTAINER" caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile >> "$log" 2>&1 < /dev/null; then
      binding_mark_served "$desired"
      binding_report_active running 'The proxy on this machine serves this address.'
      return 0
    fi
    # A refused reload leaves the proxy on its previous configuration: the sites
    # it already loaded are still served, the changed ones are not.
    local reason
    reason=$(binding_caddy_error "$log")
    for environment in "${!BINDING_ACTIVE[@]}"; do
      if binding_regular "$BINDING_ROOT/$environment/served.sha256" &&
        [ "$(head -c 64 "$BINDING_ROOT/$environment/served.sha256")" = "$(binding_site_hash "$environment")" ] &&
        [ -z "${BINDING_NOTE[$environment]:-}" ]; then
        binding_report "$environment" "${BINDING_ACTIVE[$environment]}" running 'The proxy on this machine serves this address.'
      else
        binding_report "$environment" "${BINDING_ACTIVE[$environment]}" failed "The proxy refused the new configuration: $reason"
      fi
    done
    return 0
  fi
  # Not running: a container that stopped by itself says why in its log.
  previous=""
  if [ -n "$state" ] && [ "$desired" = "$served" ]; then
    docker logs --tail 20 "$BINDING_EDGE_CONTAINER" > "$log" 2>&1 < /dev/null || true
    previous=$(binding_caddy_error "$log")
  fi
  if ! docker run --rm --network host -e ALPHACI_APP_UPSTREAM=127.0.0.1 \
    -v "$BINDING_ROOT:/bindings:ro" -v "$BINDING_EDGE_DIR/Caddyfile:/etc/caddy/Caddyfile:ro" \
    "$image" caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile > "$log" 2>&1 < /dev/null; then
    binding_edge_stop
    binding_report_active failed "The proxy refused the configuration: $(binding_caddy_error "$log")"
    return 0
  fi
  binding_edge_stop
  if ! docker run -d --name "$BINDING_EDGE_CONTAINER" --network host --restart unless-stopped \
    --label com.alphaci.edge=true --log-opt max-size=10m --log-opt max-file=3 \
    --tmpfs /run/alphaci-edge -e ALPHACI_APP_UPSTREAM=127.0.0.1 \
    -v "$BINDING_ROOT:/bindings:ro" -v "$BINDING_EDGE_DIR:/etc/caddy:ro" \
    -v alphaci-edge-data:/data -v alphaci-edge-config:/config \
    "$image" > "$log" 2>&1 < /dev/null; then
    binding_edge_stop
    binding_report_active failed "The proxy could not start: $(binding_caddy_error "$log")"
    return 0
  fi
  binding_mark_served "$desired"
  if [ -n "$previous" ]; then
    binding_report_active failed "The proxy stopped ($previous). Starting it again."
  else
    binding_report_active starting 'Starting the proxy for this address.'
  fi
}

# binding_sync <reply.json>: serves exactly the bindings the reply lists. A
# reply without the key (an older server) lists none.
binding_sync() {
  local reply="$1" mode order dir environment
  BINDING_ACTIVE=(); BINDING_NOTE=(); BINDING_KEEP=" "; BINDING_SEEN=" "
  mode=$(binding_edge_mode)
  while IFS= read -r order; do
    binding_sync_one "$mode" "$order"
  done < <(jq -c '.bindings // [] | if type == "array" then .[] | objects else empty end' "$reply" 2> /dev/null || true)
  # Only folders named by an environment UUID are ever removed.
  for dir in "$BINDING_ROOT"/*/; do
    [ -d "$dir" ] || continue
    environment=$(basename "$dir")
    [[ "$environment" =~ $BINDING_UUID ]] || continue
    case "$BINDING_KEEP" in *" $environment "*) ;; *) rm -rf "${BINDING_ROOT:?}/$environment" ;; esac
  done
  if [ "$mode" = appliance ]; then
    binding_edge_stop
    binding_report_active running "The AlphaCI server's proxy serves this address."
  else
    binding_edge_sync
  fi
}

# binding_stop_all: stops the proxy and removes every binding with its private
# key. Used when the machine is revoked, uninstalled, or cannot authenticate.
binding_stop_all() {
  local dir environment
  binding_edge_stop
  for dir in "$BINDING_ROOT"/*/; do
    [ -d "$dir" ] || continue
    environment=$(basename "$dir")
    [[ "$environment" =~ $BINDING_UUID ]] && rm -rf "${BINDING_ROOT:?}/$environment"
  done
  return 0
}
