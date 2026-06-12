# Waldwirtschaft Heidekoenig Reservierungsanfragen

Self-hosted Next.js app for reservation requests for the outdoor gastronomy of Waldwirtschaft Heidekoenig. The app accepts requests only; a reservation becomes valid only after personal confirmation by staff.

## Features

- Public request form for date, time, guest count, contact data and privacy acknowledgement
- Server-side blocking for Sundays, NRW public holidays and manually blocked days
- Admin login on a separate host
- Roles: `admin` and `mitarbeiter`
- Admin areas for requests, blocked days, opening hours, users, settings, SMTP and branding
- Internal reservation email with ICS attachment
- Automatic guest receipt email that clearly states the reservation is only a request
- PostgreSQL via internal Docker network only
- Local uploads for logo and favicon
- Persistent local encryption key for encrypted SMTP password storage
- Retention cleanup for old reservation requests and audit logs

## Tech Stack

- Next.js App Router, React and TypeScript in strict mode
- Tailwind CSS with local Liquid-Glass-inspired components
- Drizzle ORM and PostgreSQL
- Zod validation
- Argon2id password hashing and server-side sessions
- Nodemailer SMTP delivery and `ics` calendar attachments
- `date-holidays` for German/NRW holiday checks
- Docker, Docker Compose and self-hosted PostgreSQL

## Documentation

Core documents:

- [Product requirements](docs/product-requirements.md)
- [Architecture](docs/architecture.md)
- [Design system](docs/design-system.md)
- [Database](docs/database.md)
- [Database security](docs/database-security.md)
- [Self-hosting](docs/self-hosting.md)
- [Deployment wizard](docs/deployment-wizard.md)
- [Reverse proxy](docs/reverse-proxy.md)
- [Domain routing](docs/domain-routing.md)
- [E-mail flow](docs/email-flow.md)
- [Admin guide](docs/admin-guide.md)
- [Development workflow](docs/development-workflow.md)
- [Security](docs/security.md)
- [Authentication and roles](docs/auth-and-roles.md)
- [Settings and secrets](docs/settings-and-secrets.md)
- [Branding](docs/branding.md)
- [Privacy and retention](docs/privacy-and-retention.md)
- [Accessibility](docs/accessibility.md)
- [Compatibility](docs/compatibility.md)
- [Backup and restore](docs/backup-and-restore.md)
- [NFS backup](docs/nfs-backup.md)
- [Operations runbook](docs/operations-runbook.md)
- [Final project report](docs/final-project-report.md)

## Quickstart With Docker Compose

1. Clone the repository.

   ```bash
   git clone https://github.com/JPilger-ops/Gorms.res.git
   cd Gorms.res
   ```

2. Create `.env`.

   ```bash
   cp .env.example .env
   ```

3. Set at least these values in `.env`.

   ```env
   POSTGRES_APP_PASSWORD=replace-with-a-strong-password
   SESSION_SECRET=replace-with-a-long-random-secret
   SETUP_TOKEN=replace-with-a-one-time-setup-token
   ```

   `APP_ENCRYPTION_KEY` may stay empty. If empty, the app creates a persistent key in the Docker volume `heidekoenig_secrets` at `/app/secrets/app_encryption_key`.

4. Start the stack.

   ```bash
   docker compose up -d
   ```

5. Run migrations manually.

   ```bash
   docker compose exec app node scripts/migrate.mjs
   ```

   Alternative: set `RUN_MIGRATIONS_ON_START=true` deliberately before starting the app. The default is `false`.

6. Route the existing reverse proxy to the app host on port `6043`.

   ```text
   heidekönig.gorms.de        -> http://<APP_HOST_IP>:6043
   xn--heideknig-57a.gorms.de -> http://<APP_HOST_IP>:6043
   login.gorms.de             -> http://<APP_HOST_IP>:6043
   ```

   The reverse proxy must preserve the original external host through `Host` or
   `X-Forwarded-Host`.

7. Open the setup wizard through the admin host.

   ```text
   https://login.gorms.de/setup
   ```

8. Complete setup, create the first admin user, configure SMTP and verify with a test mail.

9. Use the app.

   ```text
   Public: https://heidekönig.gorms.de
   Admin:  https://login.gorms.de
   ```

## Required Routing Rules

The reverse proxy must route both hosts to the same app container or app host. The app also checks hostnames server-side.

- `heidekönig.gorms.de` and `xn--heideknig-57a.gorms.de`: public reservation pages only
- `login.gorms.de`: setup, login and admin only
- `/admin`, `/login` and `/setup` must not be exposed through the public host
- Public reservation actions must not be accepted through the admin host

The app listens internally over HTTP. SSL/TLS termination remains at the existing reverse proxy.
The reverse proxy must preserve the external hostname; otherwise the app's host checks will reject
the request.

## Docker Architecture

```text
Internet
  -> Existing reverse proxy
  -> app container on port 6043
  -> internal Docker network
  -> PostgreSQL container
```

PostgreSQL is attached only to the internal Docker network. No `5432` port is published.

Persistent volumes:

- `heidekoenig_postgres_data`: PostgreSQL data
- `heidekoenig_uploads`: logo, favicon and other uploads
- `heidekoenig_secrets`: generated app encryption key
- NFS bind mount: backup target, default host path `/mnt/heidekoenig-backups`

## Migrations

Default deployment is conservative: migrations do not run automatically.

Manual command:

```bash
docker compose exec app node scripts/migrate.mjs
```

Explicit automatic migration:

```env
RUN_MIGRATIONS_ON_START=true
```

Use automatic migration only when you have reviewed the pending migration and have a current backup.

## Setup Wizard

The setup wizard is only reachable on the admin host and only while setup is incomplete. It requires `SETUP_TOKEN` from `.env`. After setup is completed and an admin exists, the wizard is disabled.

The app logs startup status:

- setup completed, app is ready
- setup wizard required at `/setup` on the admin host

## Environment Variables

Start from `.env.example`. The minimum required values are:

- `POSTGRES_APP_PASSWORD`
- `SESSION_SECRET`
- `SETUP_TOKEN`

Common operational values:

- `PUBLIC_ALLOWED_HOSTS`
- `ADMIN_ALLOWED_HOSTS`
- `NEXT_PUBLIC_SITE_URL`
- `ADMIN_APP_URL`
- `RESERVATION_NOTIFICATION_EMAIL`
- `SMTP_HOST`
- `SMTP_PORT`
- `BACKUP_HOST_PATH`

`APP_ENCRYPTION_KEY` can be left empty for the setup flow. In that case the app creates a persistent
key in the `heidekoenig_secrets` Docker volume. See
[settings and secrets](docs/settings-and-secrets.md).

## Admin Setup And Roles

The initial admin is created through `https://login.gorms.de/setup`. The wizard requires the
one-time setup token from `.env` and is disabled after setup completion.

Roles:

- `admin`: full access to reservations, blocked days, opening hours, settings, SMTP, branding,
  users and system/security information
- `mitarbeiter`: access to reservation requests, blocked days and opening hours

See [authentication and roles](docs/auth-and-roles.md) and [admin guide](docs/admin-guide.md).

## Security Notes

- Keep `.env` out of Git.
- Do not publish PostgreSQL port `5432`.
- Keep admin cookies host-only for `login.gorms.de`.
- Do not set cookie domain to `.gorms.de`.
- Protect the Docker host, upload volume, secret volume and backup path.
- If the generated encryption-key volume is lost, encrypted SMTP passwords must be re-entered.

## Retention Cleanup

Manual cleanup:

```bash
docker compose exec app node scripts/cleanup-reservations.mjs
```

The cleanup deletes reservation requests and audit logs older than the configured retention values.

## Privacy And Data Minimization

The app stores only the guest data needed to process reservation requests. It does not use analytics,
marketing cookies, persistent IP storage or tracking IDs. Reservation requests default to 30 days
retention; audit logs default to 90 days retention.

See [privacy and retention](docs/privacy-and-retention.md).

## NFS Backups

The host mounts the NAS share, for example:

```bash
sudo mkdir -p /mnt/heidekoenig-backups
sudo mount -t nfs 192.100.100.152:/mnt/Vault/Backups/Backup_Gorms.Res /mnt/heidekoenig-backups
```

The NAS-side backup permission should be restricted to the dedicated NAS user `Gorms`.

Run a manual backup:

```bash
cd <APP_DIR>
docker compose --profile backup run --rm backup
```

Recommended host cron example:

```cron
0 3 * * * cd <APP_DIR> && docker compose --profile backup run --rm backup
```

Use the production repository path for `<APP_DIR>`, for example `/opt/heidekoenig-reservations`.

Backups include:

- PostgreSQL dump: `postgres.dump`
- Uploads archive: `uploads.tar.gz`
- Manifest: `manifest.txt`

Backups older than `BACKUP_RETENTION_DAYS` are removed by the backup job. The default is 30 days.

Restore example:

```bash
cd <APP_DIR>
docker compose stop app
docker compose --profile backup run --rm --entrypoint /bin/sh backup /scripts/restore-postgres.sh /backups/20260525T030000Z
docker compose up -d
```

Backups contain personal data. Restrict access to the NAS share and never expose the backup path through the reverse proxy.

## Local Development

```bash
npm install
npm run dev
```

Development server:

```text
http://localhost:6043
```

Use appropriate Host headers or local DNS entries when testing host-based routing.
