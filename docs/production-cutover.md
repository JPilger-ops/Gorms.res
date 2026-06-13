# Production Cutover Checklist

This checklist is for moving from the current debug deployment to the later production server.
Replace every example path with the real production path.

## Current Verified Baseline

Last verified debug deployment:

```text
Date:                         2026-06-13
Deployment checkout commit:   ade53ce
Last rebuilt app image commit: ac90f9e
Debug path:                   /opt/app/Gorms.res
App port:                     6043
Public host:                  xn--heideknig-57a.gorms.de
Admin host:                   login.gorms.de
```

Verified on the debug deployment:

- Docker app and database containers are healthy.
- Host-based routing blocks admin routes on the public host.
- Host-based routing blocks public reservation routes on the admin host.
- Public request, staff notification, guest receipt and manual decline mailflow work.
- Local Ollama draft generation is enabled but cannot send emails or change status.
- NFS backup to the NAS export works with UID/GID `3007:3009`.
- `npm audit` is clean after dependency hardening.
- GitHub Actions CI succeeds with install, lint, typecheck, format check and build.

## Production Inputs To Confirm

Before starting the production cutover, confirm:

- Production app host IP.
- Reverse proxy IP that may reach the app host on TCP `6043`.
- Production repository path, for example `/opt/heidekoenig-reservations`.
- NAS export remains `192.100.100.152:/mnt/Vault/Backups/Backup_Gorms.Res` or a new export is
  created.
- NFS mount path remains `/mnt/heidekoenig-backups` or is changed consistently in `.env`.
- SMTP settings are final in the admin panel.
- Branding assets are final or intentionally deferred.

## Production Server Preflight

Install on the production app host:

- Docker Engine
- Docker Compose plugin
- Git
- NFS client package

Create the production directory:

```bash
sudo mkdir -p /opt/heidekoenig-reservations
sudo chown -R <operator>:<operator> /opt/heidekoenig-reservations
```

Clone the repository:

```bash
cd /opt
git clone https://github.com/JPilger-ops/Gorms.res.git heidekoenig-reservations
cd /opt/heidekoenig-reservations
git checkout main
```

## Environment File

Create `.env` from the example:

```bash
cp .env.example .env
chmod 600 .env
```

Set at minimum:

```env
POSTGRES_APP_PASSWORD=<strong unique password>
SESSION_SECRET=<strong random secret>
SETUP_TOKEN=<one-time setup token>
PUBLIC_ALLOWED_HOSTS=heidekönig.gorms.de,xn--heideknig-57a.gorms.de
ADMIN_ALLOWED_HOSTS=login.gorms.de
NEXT_PUBLIC_SITE_URL=https://heidekönig.gorms.de
ADMIN_APP_URL=https://login.gorms.de
BACKUP_HOST_PATH=/mnt/heidekoenig-backups
BACKUP_CONTAINER_PATH=/backups
RUN_MIGRATIONS_ON_START=false
```

`APP_ENCRYPTION_KEY` may remain empty. If empty, the app creates a persistent key in the Docker
volume `heidekoenig_secrets`. Protect that volume because encrypted SMTP passwords depend on it.

Do not copy `.env` into Git or into an unsecured NAS path.

## NFS Backup Mount

Mount and test the NAS path before starting scheduled backups:

```bash
sudo mkdir -p /mnt/heidekoenig-backups
sudo mount -t nfs 192.100.100.152:/mnt/Vault/Backups/Backup_Gorms.Res /mnt/heidekoenig-backups
findmnt /mnt/heidekoenig-backups
sudo setpriv --reuid=3007 --regid=3009 --clear-groups touch /mnt/heidekoenig-backups/.write-test
sudo setpriv --reuid=3007 --regid=3009 --clear-groups rm /mnt/heidekoenig-backups/.write-test
```

Persist only after the write test succeeds:

```bash
echo '192.100.100.152:/mnt/Vault/Backups/Backup_Gorms.Res /mnt/heidekoenig-backups nfs defaults,_netdev,nofail 0 0' | sudo tee -a /etc/fstab
```

## First Production Start

Start database and app:

```bash
docker compose up -d
docker compose ps
```

Run migrations manually:

```bash
docker compose exec app node scripts/migrate.mjs
```

Restart the app after migrations if needed:

```bash
docker compose restart app
docker compose logs --tail=80 app
```

Expected startup log after setup is complete:

```text
Startup status: setup completed, app is ready.
```

## Reverse Proxy And Firewall

Create firewall rules:

- Allow reverse proxy IP to production app host TCP `6043`.
- Deny other VLAN clients to production app host TCP `6043`.
- Do not publish PostgreSQL `5432`.
- Do not expose backup paths, upload volume or secret volume.

In Nginx Proxy Manager route both hosts to the same app endpoint:

```text
xn--heideknig-57a.gorms.de -> http://<PRODUCTION_APP_HOST_IP>:6043
login.gorms.de             -> http://<PRODUCTION_APP_HOST_IP>:6043
```

Preserve:

```text
Host
X-Forwarded-Host
X-Forwarded-Proto
X-Forwarded-For
```

Cloudflare should use Full Strict TLS to the reverse proxy. The app itself stays internal HTTP.

## Setup Wizard

Open only through the admin host:

```text
https://login.gorms.de/setup
```

Complete:

1. Setup token check.
2. System check.
3. First admin.
4. Business settings.
5. SMTP and test mail.
6. Templates, privacy, backup and branding.

After setup, verify:

```bash
docker compose exec db psql -U heidekoenig_app -d heidekoenig -c "select key, value from app_settings where key = 'setup_completed';"
```

Expected:

```text
setup_completed | true
```

## Go-Live Smoke Tests

Run routing checks:

```bash
curl -I https://xn--heideknig-57a.gorms.de/
curl -I https://login.gorms.de/login
curl -I https://login.gorms.de/admin
curl -I https://xn--heideknig-57a.gorms.de/admin
curl -I https://login.gorms.de/reservieren
```

Expected:

```text
Public home:        200
Admin login:        200
Admin /admin:       307 to /login without session
Public /admin:      404
Admin /reservieren: 404
```

Run backup:

```bash
docker compose --profile backup run --rm backup
```

Run the live workflow smoke test only when real test emails are acceptable:

```bash
export SMOKE_CONFIRM_SEND_EMAILS=I_UNDERSTAND
export SMOKE_ADMIN_EMAIL='<admin email>'
export SMOKE_ADMIN_PASSWORD='<admin password>'
docker run -i --rm --network host \
  -v "$PWD":/work -w /work \
  -e SMOKE_CONFIRM_SEND_EMAILS \
  -e SMOKE_ADMIN_EMAIL \
  -e SMOKE_ADMIN_PASSWORD \
  mcr.microsoft.com/playwright:v1.56.1-noble \
  sh -lc 'npm install --prefix /tmp/smoke playwright@1.56.1 >/tmp/smoke-npm.log && NODE_PATH=/tmp/smoke/node_modules npm run smoke:live-workflow'
```

## Rollback

For a bad app deploy without schema changes:

```bash
git log --oneline -5
git checkout <previous-good-commit>
docker compose up -d --build app
```

For a bad schema/data change:

1. Stop the app.
2. Restore from the last verified backup.
3. Rebuild the app at the matching commit.
4. Repeat smoke tests.

Do not restore production data over a running production app.

## Handover Acceptance

Production is ready for operational use when:

- App and DB containers are healthy.
- Public/admin host routing passes.
- Setup is completed and disabled.
- SMTP test mail works.
- One live reservation request flow has been tested or intentionally deferred.
- Backup writes to NAS and contains `postgres.dump`, `uploads.tar.gz` and `manifest.txt`.
- Restore test has been performed on a non-production target or scheduled as the first post-go-live
  task.
- Admin credentials are handed over securely outside Git and chat logs.
