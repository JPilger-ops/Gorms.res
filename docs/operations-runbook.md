# Operations Runbook

## Current Verified Deployment

This runbook documents the verified deployment checks from 2026-06-12.

Current debug deployment path:

```text
/opt/app/Gorms.res
```

The later production server may use a different path. Replace the path in commands when deploying
to another host.

For the full migration from the current debug host to the later production server, use the
[Production Cutover Checklist](production-cutover.md).

For the current verified debug deployment snapshot, see [Current Live Status](current-live-status.md).

## Deployment Update

Run on the app host:

```bash
cd /opt/app/Gorms.res
git pull
docker compose build app
docker compose up -d app
```

If Git reports permission errors in the deployment repository, fix repository ownership:

```bash
sudo chown -R dev:dev /opt/app/Gorms.res
```

If Git reports a dubious ownership warning, add the deployment path as a safe directory for the
operator account:

```bash
git config --global --add safe.directory /opt/app/Gorms.res
```

## Health Checks

Check containers:

```bash
cd /opt/app/Gorms.res
docker compose ps
```

Expected:

```text
heidekoenig-app   healthy   0.0.0.0:6043->6043/tcp
heidekoenig-db    healthy   5432/tcp
```

Check local app health through the admin host header:

```bash
docker compose exec app node -e "require('node:http').get({ host: '127.0.0.1', port: 6043, path: '/login', headers: { Host: process.env.ADMIN_HOST || 'login.gorms.de' } }, (r) => { console.log(r.statusCode); process.exit(r.statusCode && r.statusCode < 500 ? 0 : 1); }).on('error', (e) => { console.error(e); process.exit(1); })"
```

Expected:

```text
200
```

Check startup logs:

```bash
docker compose logs --tail=80 app
```

Expected:

```text
Startup status: setup completed, app is ready.
```

## Routing Smoke Test

Run from the app host or another machine with DNS access:

```bash
curl -I https://xn--heideknig-57a.gorms.de/
curl -I https://login.gorms.de/login
curl -I https://login.gorms.de/admin
curl -I https://xn--heideknig-57a.gorms.de/login
curl -I https://xn--heideknig-57a.gorms.de/admin
curl -I https://login.gorms.de/reservieren
```

Expected:

```text
Public home:       200
Admin login:       200
Admin /admin:      307 to /login when not authenticated
Public /login:     404
Public /admin:     404
Admin /reservieren: 404
```

## Live Reservation Workflow Smoke Test

This test creates a real public reservation request, sends the normal staff and guest receipt
emails, logs into the admin app and sends a manual decline email. Use it only after SMTP has been
configured intentionally.

Required environment variables:

```bash
export SMOKE_CONFIRM_SEND_EMAILS=I_UNDERSTAND
export SMOKE_ADMIN_EMAIL='admin@example.test'
export SMOKE_ADMIN_PASSWORD='set-this-in-your-shell-history-safe-way'
```

Optional environment variables:

```bash
export SMOKE_PUBLIC_URL='https://xn--heideknig-57a.gorms.de'
export SMOKE_ADMIN_URL='https://login.gorms.de'
export SMOKE_DATE='2026-06-24'
export SMOKE_TIME='12:00'
export SMOKE_GUEST_COUNT='2'
export SMOKE_GUEST_EMAIL="$SMOKE_ADMIN_EMAIL"
```

Run through the Playwright container so the deployment host does not need browser packages:

```bash
cd /opt/app/Gorms.res
docker run -i --rm --network host \
  -v "$PWD":/work -w /work \
  -e SMOKE_CONFIRM_SEND_EMAILS \
  -e SMOKE_ADMIN_EMAIL \
  -e SMOKE_ADMIN_PASSWORD \
  -e SMOKE_PUBLIC_URL \
  -e SMOKE_ADMIN_URL \
  -e SMOKE_DATE \
  -e SMOKE_TIME \
  -e SMOKE_GUEST_COUNT \
  -e SMOKE_GUEST_EMAIL \
  mcr.microsoft.com/playwright:v1.56.1-noble \
  sh -lc 'npm install --prefix /tmp/smoke playwright@1.56.1 >/tmp/smoke-npm.log && NODE_PATH=/tmp/smoke/node_modules npm run smoke:live-workflow'
```

Expected result:

```json
{ "ok": true, "reservationId": "...", "guestName": "Smoke Testgast ..." }
```

After the test, verify the created request if needed:

```bash
docker compose exec db psql -U heidekoenig_app -d heidekoenig -c "select status from reservation_requests where guest_name like 'Smoke Testgast%' order by created_at desc limit 1;"
```

Expected status:

```text
declined
```

## Database Checks

Check setup and retention settings:

```bash
docker compose exec db psql -U heidekoenig_app -d heidekoenig -c "select key, value from app_settings where key in ('setup_completed','reservation_retention_days','audit_log_retention_days','backup_retention_days') order by key;"
```

The verified deployment returned:

```text
audit_log_retention_days   90
reservation_retention_days 30
setup_completed            true
```

Check row counts without printing personal reservation details:

```bash
docker compose exec db psql -U heidekoenig_app -d heidekoenig -c "select 'reservation_requests' as table_name, count(*) from reservation_requests union all select 'blocked_days', count(*) from blocked_days union all select 'users', count(*) from users union all select 'sessions', count(*) from sessions union all select 'audit_log', count(*) from audit_log;"
```

The 2026-06-12 restore test used these counts:

```text
reservation_requests 3
blocked_days         1
users                1
sessions             2
audit_log            15
```

## NFS Backup Mount

Current verified NAS values:

```text
NAS IP:         192.100.100.152
NAS export:     192.100.100.152:/mnt/Vault/Backups/Backup_Gorms.Res
NAS user:       Gorms
NFS UID/GID:    3007:3009
Host path:      /mnt/heidekoenig-backups
Container path: /backups
```

Mount manually:

```bash
sudo mkdir -p /mnt/heidekoenig-backups
sudo mount -t nfs 192.100.100.152:/mnt/Vault/Backups/Backup_Gorms.Res /mnt/heidekoenig-backups
findmnt /mnt/heidekoenig-backups
```

Verify write access with the NAS UID/GID:

```bash
sudo setpriv --reuid=3007 --regid=3009 --clear-groups touch /mnt/heidekoenig-backups/.write-test
sudo setpriv --reuid=3007 --regid=3009 --clear-groups rm /mnt/heidekoenig-backups/.write-test
```

Persist the mount after the manual test succeeds:

```bash
echo '192.100.100.152:/mnt/Vault/Backups/Backup_Gorms.Res /mnt/heidekoenig-backups nfs defaults,_netdev,nofail 0 0' | sudo tee -a /etc/fstab
```

Important: if `/mnt/heidekoenig-backups` appears as a local `root:root` directory instead of an NFS
mount, backups will fail with `Permission denied`.

## Manual Backup

Run:

```bash
cd /opt/app/Gorms.res
docker compose --profile backup run --rm backup
```

Verified successful backup:

```text
/backups/20260612T112745Z
```

Verify files through the backup container, which runs as UID/GID `3007:3009`:

```bash
docker compose --profile backup run --rm --entrypoint sh backup -lc 'id; ls -l /backups/20260612T112745Z; test -f /backups/20260612T112745Z/postgres.dump; test -f /backups/20260612T112745Z/uploads.tar.gz; test -f /backups/20260612T112745Z/manifest.txt; echo backup-files-ok'
```

Expected files:

```text
postgres.dump
uploads.tar.gz
manifest.txt
```

## Restore Test Without Touching Production

This procedure tests the backup on a temporary PostgreSQL container and a temporary Docker volume.
It does not modify the production `heidekoenig-db` container.

Create a temporary restore DB:

```bash
docker rm -f heidekoenig-restore-test-db 2>/dev/null || true
docker volume rm heidekoenig_restore_test_pgdata 2>/dev/null || true
docker volume create heidekoenig_restore_test_pgdata
docker run -d --name heidekoenig-restore-test-db \
  -e POSTGRES_USER=restoretest \
  -e POSTGRES_PASSWORD=restoretest \
  -e POSTGRES_DB=heidekoenig_restore \
  -v heidekoenig_restore_test_pgdata:/var/lib/postgresql/data \
  postgres:17-alpine
```

Wait until ready:

```bash
for i in $(seq 1 30); do
  if docker exec heidekoenig-restore-test-db pg_isready -U restoretest -d heidekoenig_restore >/dev/null 2>&1; then
    echo "restore test db ready"
    break
  fi
  sleep 1
done
```

Attach the temporary DB to the internal Compose network:

```bash
docker network connect heidekoenig_internal heidekoenig-restore-test-db 2>/dev/null || true
```

Restore the dump and validate row counts:

```bash
cd /opt/app/Gorms.res
docker compose --profile backup run --rm --entrypoint sh backup -lc '
  export PGPASSWORD=restoretest
  pg_restore --host=heidekoenig-restore-test-db --port=5432 --username=restoretest --dbname=heidekoenig_restore --clean --if-exists --no-owner --no-acl /backups/20260612T112745Z/postgres.dump
  psql --host=heidekoenig-restore-test-db --port=5432 --username=restoretest --dbname=heidekoenig_restore -c "select '\''reservation_requests'\'' as table_name, count(*) from reservation_requests union all select '\''blocked_days'\'', count(*) from blocked_days union all select '\''users'\'', count(*) from users union all select '\''sessions'\'', count(*) from sessions union all select '\''audit_log'\'', count(*) from audit_log order by table_name;"
'
```

Test upload archive extraction:

```bash
docker compose --profile backup run --rm --entrypoint sh backup -lc '
  set -eu
  rm -rf /tmp/heidekoenig-upload-restore-test
  mkdir -p /tmp/heidekoenig-upload-restore-test
  tar -xzf /backups/20260612T112745Z/uploads.tar.gz -C /tmp/heidekoenig-upload-restore-test
  file_count="$(find /tmp/heidekoenig-upload-restore-test -type f | wc -l | tr -d " ")"
  find /tmp/heidekoenig-upload-restore-test -maxdepth 3 -type f | sort
  test "${file_count}" -gt 0
  echo "uploads-restore-ok files=${file_count}"
'
```

Verified result on 2026-06-12:

```text
uploads-restore-ok files=2
```

Cleanup:

```bash
docker rm -f heidekoenig-restore-test-db
docker volume rm heidekoenig_restore_test_pgdata
docker compose ps
```

Expected after cleanup:

```text
heidekoenig-app healthy
heidekoenig-db  healthy
```

## Security Notes

Backups contain personal reservation data. Keep access restricted to server administrators and the
dedicated NAS user. Never expose `/mnt/heidekoenig-backups` or `/backups` through the reverse proxy.
