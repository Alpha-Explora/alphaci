#!/usr/bin/env bash
# Rolls the AlphaCI platform on the enterprise Compute Engine VM
# (alphaci-enterprise-01) to two GHCR images pinned by digest and to the
# settings render.sh produced. Runs on the VM as root, copied there by
# .github/workflows/deploy-enterprise-gce.yml.
#
#   rollout.sh <api-image@digest> <web-image@digest> <revision> <registry-user> < bundle
#
# The bundle on stdin has one item per line, values in base64:
#   token <GHCR token>             used only if an image must be pulled
#   env <alphaci.env>              replaces alphaci.env
#   secret <name> <contents>       replaces secrets/<name>
#
# Only the `api` and `web` services restart, and `proxy` when alphaci.env
# changed. The host agent and the app containers in the same directory keep
# running, and secret files the bundle does not name are left alone. Nothing
# restarts when neither images nor settings changed. Before a change the
# script copies .env, alphaci.env and the changed secrets to
# .deploy-backups/<UTC time>/, and restores them if the services do not
# become healthy.
set -euo pipefail

INSTALL_DIR=${ALPHACI_INSTALL_DIR:-/opt/alphaci}
WAIT_SECONDS=300
KEEP_BACKUPS=10
SECRET_UID=1001 # the api container's user

die() { echo "rollout: $*" >&2; exit 1; }
log() { echo "rollout: $*"; }

[[ $# -eq 4 ]] || die "usage: $0 <api-image@digest> <web-image@digest> <revision> <registry-user> < bundle"
api_image=$1 web_image=$2 revision=$3 registry_user=$4

[[ $api_image =~ ^ghcr\.io/alpha-explora/alphaci-be@sha256:[0-9a-f]{64}$ ]] || die "unexpected api image: $api_image"
[[ $web_image =~ ^ghcr\.io/alpha-explora/alphaci-fe@sha256:[0-9a-f]{64}$ ]] || die "unexpected web image: $web_image"
[[ $revision =~ ^[0-9a-f]{40}$ ]] || die "revision must be a full commit SHA: $revision"
[[ $registry_user =~ ^[A-Za-z0-9-]+(\[bot\])?$ ]] || die "unexpected registry user: $registry_user"

cd "$INSTALL_DIR"
[[ -f compose.yaml && -f .env && -d secrets ]] || die "$INSTALL_DIR has no compose.yaml, .env or secrets/"

exec 9>.deploy.lock
flock -n 9 || die "another deploy holds $INSTALL_DIR/.deploy.lock"

# Read the bundle into a private directory.
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
mkdir "$work/secrets"
token=''
have_env=false
while read -r kind a b; do
  case $kind in
    token) token=$(base64 -d <<< "$a") ;;
    env) base64 -d <<< "$a" > "$work/alphaci.env"; have_env=true ;;
    secret)
      [[ $a =~ ^[a-z][a-z0-9_]*$ ]] || die "bad secret name in the bundle: $a"
      base64 -d <<< "$b" > "$work/secrets/$a" ;;
    '') ;;
    *) die "unknown bundle line: $kind" ;;
  esac
done
$have_env || die "the bundle has no alphaci.env"
grep -vqE '^([A-Z][A-Z0-9_]*=.*)?$' "$work/alphaci.env" && die "the rendered alphaci.env has a line that is not KEY=value"

# What changed. Secrets compare without trailing line breaks, which the
# api trims when it reads them.
pin() { sed -n "s/^$1=//p" .env | head -n 1; }
images_changed=false
[[ $(pin ALPHACI_API_IMAGE) == "$api_image" && $(pin ALPHACI_WEB_IMAGE) == "$web_image" ]] || images_changed=true
env_changed=false
cmp -s "$work/alphaci.env" alphaci.env || env_changed=true
changed_secrets=()
for file in "$work"/secrets/*; do
  [[ -e $file ]] || continue
  name=$(basename "$file")
  if [[ ! -f secrets/$name ]] || [[ "$(cat "secrets/$name")" != "$(cat "$file")" ]]; then
    changed_secrets+=("$name")
  fi
done

if ! $images_changed && ! $env_changed && (( ${#changed_secrets[@]} == 0 )); then
  log "images and settings already match $revision; nothing to do"
  exit 0
fi
log "changes: images=$images_changed alphaci.env=$env_changed secrets=[${changed_secrets[*]}]"

if $images_changed; then
  for image in "$api_image" "$web_image"; do
    docker image inspect "$image" >/dev/null 2>&1 && continue
    [[ -n $token ]] || die "$image is not on the VM and the bundle has no registry token"
    docker_config="$work/docker"
    mkdir -p "$docker_config"
    if [[ ! -f $docker_config/config.json ]]; then
      printf '%s' "$token" | DOCKER_CONFIG=$docker_config docker login ghcr.io --username "$registry_user" --password-stdin >/dev/null
    fi
    log "pulling $image"
    DOCKER_CONFIG=$docker_config docker pull --quiet "$image" >/dev/null
  done
fi
token=''

backup=.deploy-backups/$(date -u +%Y%m%dT%H%M%SZ)
mkdir -p -m 0700 .deploy-backups
mkdir -m 0700 "$backup" "$backup/secrets"
cp -p .env alphaci.env "$backup/"
for name in "${changed_secrets[@]}"; do
  [[ -f secrets/$name ]] && cp -p "secrets/$name" "$backup/secrets/"
done

set_pin() {
  local key=$1 value=$2
  if grep -q "^$key=" .env; then
    sed -i "s|^$key=.*|$key=$value|" .env
  else
    printf '%s=%s\n' "$key" "$value" >> .env
  fi
}

# Replace a file in place through a temporary file in the same directory, so
# a reader never sees half of it. Keeps the current owner and mode.
replace() {
  local source=$1 target=$2 owner=$3 mode=$4
  if [[ -e $target ]]; then
    owner=$(stat -c '%u:%g' "$target")
    mode=$(stat -c '%a' "$target")
  fi
  local temporary
  temporary=$(mktemp "$target.XXXXXX")
  cat "$source" > "$temporary"
  chown "$owner" "$temporary"
  chmod "$mode" "$temporary"
  mv -f "$temporary" "$target"
}

restore() {
  cp -p "$backup/.env" "$backup/alphaci.env" .
  for name in "${changed_secrets[@]}"; do
    if [[ -f $backup/secrets/$name ]]; then
      cp -p "$backup/secrets/$name" secrets/
    else
      rm -f "secrets/$name"
    fi
  done
}

# Through the proxy on this machine, the way users reach both services.
# Loopback only, so the certificate (public or internal CA) is not checked.
proxy_healthy() {
  local host
  host=$(sed -n 's/^ALPHACI_HOSTNAME=//p' alphaci.env | tr -d '"' | head -n 1)
  [[ -n $host ]] || { echo "rollout: ALPHACI_HOSTNAME is not set in alphaci.env" >&2; return 1; }
  curl -fsSk --max-time 15 --retry 5 --retry-delay 3 --retry-all-errors \
    --resolve "$host:443:127.0.0.1" "https://$host/api/v1/health" >/dev/null &&
    curl -fsSk --max-time 15 --retry 5 --retry-delay 3 --retry-all-errors \
      --resolve "$host:443:127.0.0.1" "https://$host/healthz" >/dev/null
}

# Secrets are bind mounts that compose cannot see change, so api and web are
# always recreated. The proxy reads alphaci.env too; compose recreates it only
# when that file changed.
roll() {
  docker compose up --detach --no-deps --force-recreate --wait --wait-timeout "$WAIT_SECONDS" api web &&
    docker compose up --detach --no-deps --wait --wait-timeout "$WAIT_SECONDS" proxy
}

set_pin ALPHACI_API_IMAGE "$api_image"
set_pin ALPHACI_WEB_IMAGE "$web_image"
$env_changed && replace "$work/alphaci.env" alphaci.env 0:0 600
for name in "${changed_secrets[@]}"; do
  replace "$work/secrets/$name" "secrets/$name" "$SECRET_UID:0" 400
done

log "starting api and web at $revision"
if ! roll || ! proxy_healthy; then
  log "the services did not become healthy; restoring $backup"
  docker compose logs --no-color --tail 80 api web >&2 || true
  restore
  roll || log "the previous release did not become healthy either; check 'docker compose ps' on the VM"
  die "rollout of $revision failed and was rolled back"
fi

cat > .deployed-revision <<EOF
revision=$revision
api=$api_image
web=$web_image
deployed_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)
backup=$backup
EOF

# Keep the newest backups only.
ls -1d .deploy-backups/*/ 2>/dev/null | sort | head -n -"$KEEP_BACKUPS" | xargs -r rm -rf

# Untagged images no container uses, such as the release this one replaced.
docker image prune --force >/dev/null
log "deployed $revision"
