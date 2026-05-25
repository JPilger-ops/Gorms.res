# Final Project Report

## Status

The Waldwirtschaft Heidekoenig reservation request app has reached the planned version 1 baseline.
It is a self-hosted Next.js application behind an existing reverse proxy, with PostgreSQL running
only on an internal Docker network.

The app accepts reservation requests only. A reservation is valid only after personal confirmation
by staff.

## Delivered Capabilities

- Public reservation request flow for date, time, guest count, contact data, optional message and
  privacy acknowledgement.
- Server-side validation for required fields, business rules, opening hours, Sundays, NRW holidays
  and manually blocked days.
- Internal staff notification e-mail with `.ics` calendar attachment.
- Automatic guest receipt e-mail with clear request-only wording.
- Admin login, logout and server-side sessions.
- Roles: `admin` and `mitarbeiter`.
- Admin screens for dashboard, reservation requests, blocked days, opening hours, settings, SMTP,
  branding and user management.
- Setup wizard protected by `SETUP_TOKEN`, admin host checks and one-time completion state.
- Encrypted SMTP password storage using an app encryption key outside the database.
- Local logo/favicon upload handling through the upload volume.
- Retention cleanup for reservation requests and audit logs.
- NFS backup and restore scripts for PostgreSQL and uploads.
- GitHub Actions CI for install, lint, typecheck, format check and build.
- Documentation for product, architecture, security, deployment, reverse proxy, backup, privacy,
  accessibility and operations.

## Security Baseline

- PostgreSQL port `5432` is not published.
- Database service is attached only to the internal Docker network.
- Public and admin hosts are checked server-side.
- Public actions require public host and matching Origin.
- Admin actions require admin host and matching Origin.
- Admin cookies are HTTP-only, `SameSite=Lax`, secure in production and host-only.
- Passwords are hashed with Argon2id.
- Session tokens are stored hashed in the database.
- Rate-limit identifiers are hashed before in-memory storage.
- Public reservation form includes a honeypot.
- Security headers are configured in Next.js.
- `.env` is ignored by Git.
- Runtime upload, backup and secret directories are ignored by Git.

## Production Deployment Notes

The current repository path is a development environment. Production deployment should happen on a
separate production server.

Use a production path such as:

```text
/opt/heidekoenig-reservations
```

Route the existing reverse proxy to:

```text
heidekönig.gorms.de        -> http://<APP_HOST_IP>:6043
xn--heideknig-57a.gorms.de -> http://<APP_HOST_IP>:6043
login.gorms.de             -> http://<APP_HOST_IP>:6043
```

The reverse proxy must preserve the external hostname through `Host` or `X-Forwarded-Host`.

## Backup Notes

NFS is mounted on the production Docker host, not inside the app.

Current NAS values:

```text
NAS IP:         192.100.100.152
NAS export:     192.100.100.152:/mnt/Vault/Backups/Backup_Gorms.Res
NAS user:       Gorms
Host path:      /mnt/heidekoenig-backups
Container path: /backups
```

Backups contain personal reservation data and must be access-restricted.

## Verification Performed

- Required documentation files exist.
- `.env` and runtime state directories are ignored by Git.
- Punycode was verified:

```text
heidekönig.gorms.de -> xn--heideknig-57a.gorms.de
```

- Shell scripts passed syntax checks:

```text
scripts/backup-postgres.sh
scripts/restore-postgres.sh
```

- Docker Compose rendered successfully with dummy secrets.
- `npm run check` passed.
- Docker app image build passed with Node 22.

## Remaining Production Tasks

- Create the NAS export and mount it on the production Docker host.
- Configure Unifi firewall rules for reverse-proxy IP to app-host TCP `6043`.
- Configure production reverse-proxy host routing and TLS certificates.
- Run migrations on the production database.
- Complete setup wizard on `https://login.gorms.de/setup`.
- Configure SMTP credentials and send a test mail.
- Submit a test reservation request through the public host.
- Run a manual backup.
- Run a restore test on a non-production copy.
- Perform browser smoke tests on iOS Safari, Android Chrome, desktop Chrome, Firefox, Edge and
  Safari.

## Known Limits

- Version 1 does not provide in-app reservation acceptance or decline workflows.
- Automated browser accessibility tests are not installed yet.
- Production reverse-proxy and firewall behavior can only be verified after deployment on the final
  server.
