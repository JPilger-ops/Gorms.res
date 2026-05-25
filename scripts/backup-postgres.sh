#!/usr/bin/env sh
set -eu

BACKUP_DIR="${BACKUP_CONTAINER_PATH:-/backups}"
UPLOAD_DIR="${UPLOAD_DIR:-/app/uploads}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
RUN_DIR="${BACKUP_DIR}/${TIMESTAMP}"
DB_FILE="${RUN_DIR}/postgres.dump"
UPLOADS_FILE="${RUN_DIR}/uploads.tar.gz"
MANIFEST_FILE="${RUN_DIR}/manifest.txt"

mkdir -p "${RUN_DIR}"

export PGPASSWORD="${POSTGRES_APP_PASSWORD:?POSTGRES_APP_PASSWORD is required}"

pg_dump \
  --host="${POSTGRES_HOST:-db}" \
  --port="${POSTGRES_PORT:-5432}" \
  --username="${POSTGRES_APP_USER:-heidekoenig_app}" \
  --dbname="${POSTGRES_DB:-heidekoenig}" \
  --format=custom \
  --no-owner \
  --no-acl \
  --file="${DB_FILE}"

if [ -d "${UPLOAD_DIR}" ]; then
  tar -czf "${UPLOADS_FILE}" -C "${UPLOAD_DIR}" .
else
  mkdir -p "${RUN_DIR}/empty-uploads"
  tar -czf "${UPLOADS_FILE}" -C "${RUN_DIR}/empty-uploads" .
  rmdir "${RUN_DIR}/empty-uploads"
fi

cat > "${MANIFEST_FILE}" <<EOF
created_at=${TIMESTAMP}
postgres_db=${POSTGRES_DB:-heidekoenig}
postgres_user=${POSTGRES_APP_USER:-heidekoenig_app}
uploads_archive=uploads.tar.gz
database_dump=postgres.dump
retention_days=${RETENTION_DAYS}
EOF

find "${BACKUP_DIR}" -mindepth 1 -maxdepth 1 -type d -mtime "+${RETENTION_DAYS}" -exec rm -rf {} +

echo "Backup completed: ${RUN_DIR}"
