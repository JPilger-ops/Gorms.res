# Self-Hosting

## Deployment Model

The application is designed for Docker Compose behind an existing reverse proxy. It has no Vercel,
Supabase or external database dependency.

## Default Ports

The app listens on:

```text
6043
```

The database listens only inside Docker on `5432` and is not published to the host.

## Required Operator Tasks

1. Create `.env` from `.env.example`.
2. Set strong secrets.
3. Start Docker Compose.
4. Run migrations.
5. Configure reverse-proxy host routing.
6. Complete the setup wizard on the admin host.
7. Configure SMTP and send a test mail.
8. Configure NFS backup mount and test restore.

The production repository path is chosen on the production server, for example:

```text
/opt/heidekoenig-reservations
```

Do not use the current development directory as a production path.

## Persistent State

Docker volumes:

- `heidekoenig_postgres_data`
- `heidekoenig_uploads`
- `heidekoenig_secrets`

Host mount:

- `/mnt/heidekoenig-backups` for NFS-backed backups

## Updates

Recommended update flow:

```bash
git pull
docker compose build app
docker compose up -d
docker compose exec app node scripts/migrate.mjs
```

Run a backup before schema migrations.

## Reverse Proxy Requirement

The reverse proxy must preserve the original external host through `Host` or `X-Forwarded-Host`.
Both public and admin domains route to app port `6043`; the app decides which routes are valid for
the current hostname.
