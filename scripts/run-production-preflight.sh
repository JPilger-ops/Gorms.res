#!/usr/bin/env sh
set -eu

ENV_FILE="${PREFLIGHT_ENV_FILE:-.env}"

node_major() {
  node -p "Number.parseInt(process.versions.node.split('.')[0], 10)" 2>/dev/null || true
}

run_with_local_node() {
  PREFLIGHT_ENV_FILE="$ENV_FILE" node scripts/production-preflight.mjs
}

if command -v node >/dev/null 2>&1; then
  MAJOR="$(node_major)"
  if [ "${MAJOR:-0}" -ge 22 ] 2>/dev/null; then
    run_with_local_node
    exit $?
  fi
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "ERROR: Node 22 is not available and Docker is not available for fallback." >&2
  echo "Install or activate Node 22, for example with 'nvm use'." >&2
  exit 1
fi

DOCKER_ENV_FILE="$ENV_FILE"
ENV_MOUNT_ARGS=""

case "$ENV_FILE" in
  /*)
    if [ ! -f "$ENV_FILE" ]; then
      echo "ERROR: PREFLIGHT_ENV_FILE does not exist: $ENV_FILE" >&2
      exit 1
    fi
    DOCKER_ENV_FILE="/tmp/heidekoenig-preflight.env"
    ENV_MOUNT_ARGS="-v $ENV_FILE:$DOCKER_ENV_FILE:ro"
    ;;
esac

BACKUP_HOST_PATH="$(
  if [ -f "$ENV_FILE" ]; then
    awk -F= '
      /^[[:space:]]*BACKUP_HOST_PATH[[:space:]]*=/ {
        value=$0
        sub(/^[^=]*=/, "", value)
        gsub(/^[[:space:]]+|[[:space:]]+$/, "", value)
        gsub(/^["'\'']|["'\'']$/, "", value)
        print value
        exit
      }
    ' "$ENV_FILE"
  fi
)"
BACKUP_HOST_PATH="${BACKUP_HOST_PATH:-/mnt/heidekoenig-backups}"

BACKUP_MOUNT_ARGS=""
if [ -d "$BACKUP_HOST_PATH" ]; then
  BACKUP_MOUNT_ARGS="-v $BACKUP_HOST_PATH:$BACKUP_HOST_PATH:ro"
fi

echo "WARN: Local Node 22 is not active; running preflight through Docker Node 22." >&2
echo "WARN: Docker fallback can verify configuration, but host Docker/Git checks may report warnings inside the container." >&2

# shellcheck disable=SC2086
docker run --rm \
  -v "$PWD":/work \
  $ENV_MOUNT_ARGS \
  $BACKUP_MOUNT_ARGS \
  -w /work \
  -e PREFLIGHT_ENV_FILE="$DOCKER_ENV_FILE" \
  node:22-bookworm-slim \
  node scripts/production-preflight.mjs
