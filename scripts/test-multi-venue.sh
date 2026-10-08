#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
suffix="$(date +%s)-$$"
network="gorms-phase1-test-$suffix"
database="gorms-phase1-db-$suffix"
runner="gorms-phase1-runner-$suffix"
certificates="$(mktemp -d)"
storage="$(mktemp -d)"
mkdir -p "$storage/uploads"
chmod 755 "$storage" "$storage/uploads"
cleanup() {
  docker rm -f "$runner" "$database" >/dev/null 2>&1 || true
  docker network rm "$network" >/dev/null 2>&1 || true
  rm -rf "$certificates"
  rm -rf "$storage"
}
trap cleanup EXIT INT TERM

for certificate in trusted untrusted; do
  openssl req -x509 -newkey rsa:2048 -nodes -days 1 \
    -subj /CN=localhost -addext 'subjectAltName=DNS:localhost,IP:127.0.0.1' \
    -keyout "$certificates/$certificate.key" -out "$certificates/$certificate.crt" \
    >/dev/null 2>&1
done

# No host ports, deployment volumes, operator .env or external network access.
docker network create --internal "$network" >/dev/null
docker run -d --name "$database" --network "$network" --network-alias phase1-db \
  --tmpfs /var/lib/postgresql/data \
  -v "$storage/uploads:/tmp/gorms-phase1-uploads:ro" \
  -v "$PWD/scripts:/scripts:ro" \
  -e POSTGRES_DB=gorms_phase1_test -e POSTGRES_USER=phase1 -e POSTGRES_PASSWORD=isolated-test-only \
  postgres:17-alpine >/dev/null
ready=false
for _ in {1..60}; do
  if docker exec "$database" pg_isready -U phase1 -d gorms_phase1_test >/dev/null 2>&1; then ready=true; break; fi
  sleep 1
done
if [ "$ready" != true ]; then echo "Isolated PostgreSQL failed to start." >&2; exit 1; fi

docker run --rm --name "$runner" --network "$network" --user "$(id -u):$(id -g)" \
  -v "$PWD:/workspace" -w /workspace \
  -v "$certificates:/smtp-test-certificates:ro" \
  -v "$storage/uploads:/tmp/gorms-phase1-uploads" \
  -e SMTP_TEST_CERT_DIR=/smtp-test-certificates \
  -e NODE_EXTRA_CA_CERTS=/smtp-test-certificates/trusted.crt \
  -e DATABASE_URL=postgres://phase1:isolated-test-only@phase1-db:5432/gorms_phase1_test \
  -e DOTENV_CONFIG_PATH=/dev/null -e MULTI_VENUE_ISOLATED_TEST=true \
  -e APP_ENCRYPTION_KEY=0123456789abcdef0123456789abcdef \
  -e SESSION_SECRET=phase1-session-secret-only-for-tests -e SETUP_TOKEN=phase1-setup-token-only-for-tests \
  -e 'PUBLIC_ALLOWED_HOSTS=heidekönig.gorms.de,xn--heideknig-57a.gorms.de,alias.hk.test,127.0.0.1' \
  -e ADMIN_ALLOWED_HOSTS=login.gorms.de,localhost \
  -e RESERVATION_RETENTION_DAYS=90 -e AUDIT_LOG_RETENTION_DAYS=90 \
  -e MAX_GUESTS_PER_REQUEST=70 -e INDOOR_CAPACITY=70 \
  -e SMTP_HOST=127.0.0.1 -e SMTP_PORT=1025 -e SMTP_USER=env@example.invalid \
  -e SMTP_PASSWORD=isolated-env-password -e SMTP_FROM_ADDRESS=env@example.invalid \
  -e AI_ENABLED=false -e AI_DRAFTS_ENABLED=false -e OLLAMA_BASE_URL=http://127.0.0.1:9 \
  -e UPLOAD_DIR=/tmp/gorms-phase1-uploads -e BACKUP_CONTAINER_PATH=/tmp/gorms-phase1-backups \
  -e APP_ENCRYPTION_KEY_FILE=/tmp/gorms-phase1-key -e NEXT_TELEMETRY_DISABLED=1 \
  -e MULTI_VENUE_WEB_TEST="${MULTI_VENUE_WEB_TEST:-false}" \
  -e TABLE_PLAN_BROWSER_ENGINE="${TABLE_PLAN_BROWSER_ENGINE:-}" \
  "${MULTI_VENUE_TEST_IMAGE:-node:22-bookworm-slim}" \
  bash -c 'npm run test:venue-foundation && npx tsx scripts/check-multi-venue.ts'

# Numeric NAS-style identity, but only temporary local storage in the isolated DB container.
docker exec --user 3007:3009 \
  -e POSTGRES_HOST=127.0.0.1 -e POSTGRES_DB=gorms_phase1_test -e POSTGRES_APP_USER=phase1 \
  -e POSTGRES_APP_PASSWORD=isolated-test-only -e UPLOAD_DIR=/tmp/gorms-phase1-uploads \
  -e BACKUP_CONTAINER_PATH=/tmp/gorms-phase2-backups \
  "$database" sh /scripts/backup-postgres.sh
docker exec "$database" sh -c '
  set -eu
  backup=$(find /tmp/gorms-phase2-backups -mindepth 1 -maxdepth 1 -type d | head -n 1)
  test -f "$backup/manifest.txt"
  pg_restore --list "$backup/postgres.dump" | grep -q floorplan_assets
  tar -tzf "$backup/uploads.tar.gz" | grep -q floorplans/
  createdb -U phase1 gorms_phase2_restore
  POSTGRES_HOST=127.0.0.1 POSTGRES_DB=gorms_phase2_restore POSTGRES_APP_USER=phase1 \
    POSTGRES_APP_PASSWORD=isolated-test-only UPLOAD_DIR=/tmp/gorms-phase2-restored \
    sh /scripts/restore-postgres.sh "$backup"
  count=$(psql -U phase1 -d gorms_phase2_restore -Atc "select count(*) from venues where slug=\$\$telegraph\$\$")
  test "$count" = 1
  psql -U phase1 -d gorms_phase2_restore -Atc "select file_path from floorplan_assets where id in (select floorplan_asset_id from area_plan_layouts)" | while IFS= read -r file; do
    cmp "/tmp/gorms-phase1-uploads/$file" "/tmp/gorms-phase2-restored/$file"
  done
'
if docker exec --user 3007:3009 \
  -e POSTGRES_HOST=127.0.0.1 -e POSTGRES_DB=gorms_phase1_test -e POSTGRES_APP_USER=phase1 \
  -e POSTGRES_APP_PASSWORD=isolated-test-only -e UPLOAD_DIR=/tmp/gorms-phase1-uploads \
  -e BACKUP_CONTAINER_PATH=/proc/gorms-backup-failure \
  "$database" sh /scripts/backup-postgres.sh; then
  echo "Backup failure was incorrectly reported as success." >&2
  exit 1
fi
echo "PASS: isolated pg_dump/upload backup and full restore with matching assets, UID 3007:GID 3009 and nonzero failure propagation."
