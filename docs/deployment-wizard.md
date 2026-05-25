# Deployment And Setup Wizard

## Goal

The operator should be able to start the stack with Docker Compose and finish the first configuration in the browser.

## Required `.env` Values

```env
POSTGRES_APP_PASSWORD=...
SESSION_SECRET=...
SETUP_TOKEN=...
```

`APP_ENCRYPTION_KEY` is optional. If it is empty, the app creates a persistent 32-byte key at:

```text
/app/secrets/app_encryption_key
```

This path is backed by the Docker volume `heidekoenig_secrets`.

## Start

```bash
cp .env.example .env
docker compose up -d
docker compose exec app node scripts/migrate.mjs
```

Then open:

```text
https://login.gorms.de/setup
```

## Migration Modes

Preferred manual mode:

```bash
docker compose exec app node scripts/migrate.mjs
```

Optional startup mode:

```env
RUN_MIGRATIONS_ON_START=true
```

Startup migrations are disabled by default. Enable them only deliberately after confirming backups and migration state.

## Startup Logging

At startup the app logs whether setup is completed or whether the setup wizard is required. No secrets are logged.

Expected examples:

```text
RUN_MIGRATIONS_ON_START=false: database migrations are not run automatically.
Startup status: setup wizard required at /setup on the admin host.
```

or:

```text
Startup status: setup completed, app is ready.
```

## Wizard Security

- Wizard only on `login.gorms.de`
- Requires `SETUP_TOKEN`
- Disabled after setup completion
- Disabled if an active admin exists
- Setup token is never stored in the database
- Generated encryption key is stored outside the database in the Docker secret volume

## Reverse Proxy

Route both hosts to the same app endpoint:

```text
heidekönig.gorms.de        -> http://<APP_HOST_IP>:6043
xn--heideknig-57a.gorms.de -> http://<APP_HOST_IP>:6043
login.gorms.de             -> http://<APP_HOST_IP>:6043
```

The app checks hosts server-side. Reverse-proxy path blocks are still recommended as an additional layer.
The reverse proxy must preserve the original hostname through `Host` or `X-Forwarded-Host`.
