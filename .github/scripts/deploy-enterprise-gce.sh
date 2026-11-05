#!/usr/bin/env bash
# Rolls the AlphaCI api and web services on the enterprise Compute Engine VM
# (alphaci-enterprise-01) to two GHCR images pinned by digest. Runs on the VM
# as root, copied there by .github/workflows/deploy-enterprise-gce.yml.
#
#   deploy-enterprise-gce.sh <api-image@digest> <web-image@digest> <revision> <registry-user> < token
#
# The GHCR token arrives on stdin and lives only in a temporary Docker config
# for the pulls. The script touches only the `api` and `web` services: the
# proxy, the on-prem host agent and the app containers in the same install
# directory keep running. On failure it restores the previous image pins.
# On success it records the revision in .deployed-revision, which the
# workflow's migration gate reads before the next deploy.
set -euo pipefail

INSTALL_DIR=${ALPHACI_INSTALL_DIR:-/opt/alphaci}
WAIT_SECONDS=300

die() { echo "deploy: $*" >&2; exit 1; }
log() { echo "deploy: $*"; }

[[ $# -eq 4 ]] || die "usage: $0 <api-image@digest> <web-image@digest> <revision> <registry-user> < token"
api_image=$1 web_image=$2 revision=$3 registry_user=$4

[[ $api_image =~ ^ghcr\.io/alpha-explora/alphaci-be@sha256:[0-9a-f]{64}$ ]] || die "unexpected api image: $api_image"
[[ $web_image =~ ^ghcr\.io/alpha-explora/alphaci-fe@sha256:[0-9a-f]{64}$ ]] || die "unexpected web image: $web_image"
[[ $revision =~ ^[0-9a-f]{40}$ ]] || die "revision must be a full commit SHA: $revision"
[[ $registry_user =~ ^[A-Za-z0-9-]+(\[bot\])?$ ]] || die "unexpected registry user: $registry_user"

cd "$INSTALL_DIR"
[[ -f compose.yaml && -f .env ]] || die "$INSTALL_DIR has no compose.yaml and .env"

exec 9>.deploy.lock
flock -n 9 || die "another deploy holds $INSTALL_DIR/.deploy.lock"

token=$(cat)
[[ -n $token ]] || die "no registry token on stdin"

docker_config=$(mktemp -d)
trap 'rm -rf "$docker_config"' EXIT
printf '%s' "$token" | DOCKER_CONFIG=$docker_config docker login ghcr.io --username "$registry_user" --password-stdin >/dev/null
unset token
for image in "$api_image" "$web_image"; do
  log "pulling $image"
  DOCKER_CONFIG=$docker_config docker pull --quiet "$image" >/dev/null
done
rm -rf "$docker_config"

backup=.env.before-deploy-$(date -u +%Y%m%dT%H%M%SZ)
cp -p .env "$backup"

set_pin() {
  local key=$1 value=$2
  if grep -q "^$key=" .env; then
    sed -i "s|^$key=.*|$key=$value|" .env
  else
    printf '%s=%s\n' "$key" "$value" >> .env
  fi
}

# Through the proxy on this machine, the way users reach both services.
# Loopback only, so the certificate (public or internal CA) is not checked.
proxy_healthy() {
  local host
  host=$(sed -n 's/^ALPHACI_HOSTNAME=//p' alphaci.env | tr -d '"' | head -n 1)
  [[ -n $host ]] || { echo "deploy: ALPHACI_HOSTNAME is not set in alphaci.env" >&2; return 1; }
  curl -fsSk --max-time 15 --resolve "$host:443:127.0.0.1" "https://$host/api/v1/health" >/dev/null &&
    curl -fsSk --max-time 15 --resolve "$host:443:127.0.0.1" "https://$host/healthz" >/dev/null
}

roll() { docker compose up --detach --no-deps --wait --wait-timeout "$WAIT_SECONDS" api web; }

set_pin ALPHACI_API_IMAGE "$api_image"
set_pin ALPHACI_WEB_IMAGE "$web_image"

log "starting api and web at $revision"
if ! roll || ! proxy_healthy; then
  log "the new images did not become healthy; restoring the pins from $backup"
  docker compose logs --no-color --tail 80 api web >&2 || true
  cp -p "$backup" .env
  roll || log "the previous images did not become healthy either; check 'docker compose ps' on the VM"
  die "deploy of $revision failed and was rolled back"
fi

cat > .deployed-revision <<EOF
revision=$revision
api=$api_image
web=$web_image
deployed_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)
EOF

# Untagged images no container uses, such as the release this one replaced.
docker image prune --force >/dev/null
log "deployed $revision"
