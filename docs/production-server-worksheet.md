# Production Server Worksheet

Use this worksheet before and during the move from the current debug deployment to the final
production server. It intentionally contains no secrets. Store passwords, tokens and private keys
only in the production `.env`, password manager or the protected server shell session.

## Current Known Values

```text
Repository:        https://github.com/JPilger-ops/Gorms.res.git
App port:          6043
Public host:       xn--heideknig-57a.gorms.de
Unicode host:      heidekönig.gorms.de
Admin host:        login.gorms.de
NAS export:        192.100.100.152:/mnt/Vault/Backups/Backup_Gorms.Res
NFS host path:     /mnt/heidekoenig-backups
NFS container path:/backups
NFS backup UID/GID:3007:3009
Database port:     5432 internal Docker network only
```

## Values To Confirm

Fill these outside Git before cutover:

```text
Production app host IP:
Reverse proxy source IP:
Production repository path:
Production operator user:
Unifi allow rule name:
Unifi deny rule name:
Nginx Proxy Manager host for public domain:
Nginx Proxy Manager host for admin domain:
Cloudflare SSL mode:
SMTP sender address:
Reservation notification recipient:
Final branding assets:
```

## Server Preflight

Run on the production app host:

```bash
docker --version
docker compose version
git --version
mount.nfs --version || true
```

Expected:

- Docker Engine is installed.
- Docker Compose plugin is installed.
- Git is installed.
- NFS helper package is installed.

## Repository Setup

```bash
sudo mkdir -p /opt/heidekoenig-reservations
sudo chown -R <operator>:<operator> /opt/heidekoenig-reservations
cd /opt
git clone https://github.com/JPilger-ops/Gorms.res.git heidekoenig-reservations
cd /opt/heidekoenig-reservations
git checkout main
git status
```

Expected:

```text
nothing to commit, working tree clean
```

## Environment Setup

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

Leave `APP_ENCRYPTION_KEY` empty only if the generated Docker secret volume will be backed up and
protected. If you set it manually, use a strong random value and keep it outside Git.

## NFS Mount Check

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

## First Start

```bash
docker compose up -d
docker compose ps
docker compose exec app node scripts/migrate.mjs
docker compose restart app
docker compose logs --tail=80 app
```

Expected before setup:

```text
Startup status: setup wizard required at /setup on the admin host.
```

Expected after setup:

```text
Startup status: setup completed, app is ready.
```

## Reverse Proxy And Firewall

In Unifi:

- Allow reverse proxy source IP to production app host TCP `6043`.
- Deny other clients to production app host TCP `6043`.
- Do not expose PostgreSQL TCP `5432`.

In Nginx Proxy Manager:

```text
xn--heideknig-57a.gorms.de -> http://<PRODUCTION_APP_HOST_IP>:6043
login.gorms.de             -> http://<PRODUCTION_APP_HOST_IP>:6043
```

Required proxy headers:

```text
Host
X-Forwarded-Host
X-Forwarded-Proto
X-Forwarded-For
```

Cloudflare should stay on Full Strict TLS to the reverse proxy. The app itself remains internal
HTTP behind the proxy.

## Setup Wizard

Open:

```text
https://login.gorms.de/setup
```

Complete setup with:

- first admin user
- business rules
- SMTP settings and test mail
- privacy/retention settings
- backup settings
- optional branding

Do not store the setup token or admin password in this worksheet.

## Go-Live Verification

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

Run a backup:

```bash
docker compose --profile backup run --rm backup
```

Run the live smoke test only when real test e-mails are acceptable:

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

## Acceptance

Production is ready when:

- containers are healthy
- setup is completed and disabled
- routing checks match the expected statuses
- SMTP test mail works
- backup writes `postgres.dump`, `uploads.tar.gz` and `manifest.txt`
- live workflow smoke test is completed or intentionally deferred
- first restore test is scheduled or already completed on a non-production target
- admin credentials are handed over outside Git and chat logs
