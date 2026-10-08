#!/usr/bin/env sh
set -eu

export PGPASSWORD="${POSTGRES_APP_PASSWORD:?POSTGRES_APP_PASSWORD is required}"

# Hold a shared session lock for dump AND files; floorplan GC takes the exclusive lock.
if [ "${BACKUP_LOCK_HELD:-0}" != "1" ]; then
  export BACKUP_LOCK_HELD=1
  export BACKUP_LOCK_SCRIPT="$0"
  psql --host="${POSTGRES_HOST:-db}" --port="${POSTGRES_PORT:-5432}" \
    --username="${POSTGRES_APP_USER:-heidekoenig_app}" --dbname="${POSTGRES_DB:-heidekoenig}" \
    --no-psqlrc --quiet --set=ON_ERROR_STOP=1 <<'SQL'
SELECT pg_advisory_lock_shared(724186203);
\! sh -c 'exec sh "$BACKUP_LOCK_SCRIPT"'
\if :SHELL_ERROR
  SELECT 1 / 0;
\endif
SELECT pg_advisory_unlock_shared(724186203);
SQL
  exit $?
fi

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
