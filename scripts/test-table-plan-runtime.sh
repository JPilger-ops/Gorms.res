#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
suffix="$(date +%s)-$$"
network="gorms-phase2-runtime-$suffix"
database="gorms-phase2-runtime-db-$suffix"
runner="gorms-phase2-runtime-app-$suffix"
cleanup() {
  docker rm -f "$runner" "$database" >/dev/null 2>&1 || true
  docker network rm "$network" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

# Fixed verification image, disposable database, no ports or operator mounts/env.
docker image inspect gorms-phase2-verification-app >/dev/null
docker network create --internal "$network" >/dev/null
docker run -d --name "$database" --network "$network" --network-alias phase2-runtime-db \
  --tmpfs /var/lib/postgresql/data \
  -e POSTGRES_DB=gorms_phase2_runtime -e POSTGRES_USER=phase2 -e POSTGRES_PASSWORD=isolated-runtime-only \
  postgres:17-alpine >/dev/null
ready=false
for _ in {1..60}; do
  if docker exec "$database" pg_isready -U phase2 -d gorms_phase2_runtime >/dev/null 2>&1; then ready=true; break; fi
  sleep 1
done
if [ "$ready" != true ]; then echo "Isolated runtime PostgreSQL failed to start." >&2; exit 1; fi

docker run --rm --name "$runner" --network "$network" --entrypoint /bin/sh \
  -e DATABASE_URL=postgres://phase2:isolated-runtime-only@phase2-runtime-db:5432/gorms_phase2_runtime \
  -e DOTENV_CONFIG_PATH=/dev/null -e UPLOAD_DIR=/app/uploads \
  -e PUBLIC_ALLOWED_HOSTS=xn--heideknig-57a.gorms.de,alias.hk.test \
  -e ADMIN_ALLOWED_HOSTS=login.gorms.de \
  gorms-phase2-verification-app -c '
    set -eu
    node -e '\''const assert=require("node:assert/strict"), sharp=require("sharp"); assert.equal(Number(process.versions.node.split(".")[0]),22); assert.equal(process.getuid(),1001); console.log("Image runtime:",process.versions.node,"Sharp",sharp.versions.sharp); sharp({create:{width:64,height:64,channels:4,background:"white"}}).png().toBuffer().then(b=>sharp(b).metadata()).then(m=>assert.equal(m.width,64));'\''
    node scripts/migrate.mjs
    node scripts/migrate.mjs
    node scripts/cleanup-floorplans.mjs
  '
count=$(docker exec "$database" psql -U phase2 -d gorms_phase2_runtime -Atc "select count(*) from venues")
test "$count" = 2
count=$(docker exec "$database" psql -U phase2 -d gorms_phase2_runtime -Atc "select count(*) from venue_areas")
test "$count" = 1
count=$(docker exec "$database" psql -U phase2 -d gorms_phase2_runtime -Atc "select count(*) from venue_hosts")
test "$count" = 2
echo "PASS: built Node22 image/native Sharp, nonroot UID, migration twice, hostname import and floorplan CLI against separate isolated PostgreSQL17."
