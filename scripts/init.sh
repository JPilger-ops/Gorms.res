#!/usr/bin/env sh
set -eu

echo "Heidekoenig app starting on port ${PORT:-6043}."

if [ "${RUN_MIGRATIONS_ON_START:-false}" = "true" ]; then
  echo "RUN_MIGRATIONS_ON_START=true: running database migrations."
  node scripts/migrate.mjs
else
  echo "RUN_MIGRATIONS_ON_START=false: database migrations are not run automatically."
fi

node scripts/startup-status.mjs || true

exec "$@"
