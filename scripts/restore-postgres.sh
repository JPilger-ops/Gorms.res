#!/usr/bin/env sh
set -eu

BACKUP_DIR="${1:-}"
UPLOAD_DIR="${UPLOAD_DIR:-/app/uploads}"

if [ -z "${BACKUP_DIR}" ]; then
  echo "Usage: restore-postgres.sh /backups/YYYYMMDDTHHMMSSZ"
  exit 1
fi

if [ ! -f "${BACKUP_DIR}/postgres.dump" ]; then
  echo "Missing database dump: ${BACKUP_DIR}/postgres.dump"
  exit 1
fi

if [ ! -f "${BACKUP_DIR}/uploads.tar.gz" ]; then
  echo "Missing uploads archive: ${BACKUP_DIR}/uploads.tar.gz"
  exit 1
fi

export PGPASSWORD="${POSTGRES_APP_PASSWORD:?POSTGRES_APP_PASSWORD is required}"

echo "Restoring database from ${BACKUP_DIR}/postgres.dump"

pg_restore \
  --host="${POSTGRES_HOST:-db}" \
  --port="${POSTGRES_PORT:-5432}" \
  --username="${POSTGRES_APP_USER:-heidekoenig_app}" \
  --dbname="${POSTGRES_DB:-heidekoenig}" \
  --clean \
  --if-exists \
  --no-owner \
  --no-acl \
  "${BACKUP_DIR}/postgres.dump"

echo "Restoring uploads into ${UPLOAD_DIR}"
mkdir -p "${UPLOAD_DIR}"
find "${UPLOAD_DIR}" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
tar -xzf "${BACKUP_DIR}/uploads.tar.gz" -C "${UPLOAD_DIR}"

echo "Restore completed from ${BACKUP_DIR}"
