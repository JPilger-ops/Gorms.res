# Backup And Restore

## Scope

Backups are created by the optional Docker Compose `backup` profile. The backup container joins only
the internal Docker network, connects to PostgreSQL through `db:5432`, and writes files to the
mounted backup path.

For the current NAS export, the backup container runs as numeric user `3007:3009`, matching the
write permissions observed on the mounted NFS share.

This documentation is written for the later production server. Replace `<APP_DIR>` with the
repository path on that server, for example:

```text
/opt/heidekoenig-reservations
```

## Backup Contents

Each backup run creates one timestamped directory below `/backups` inside the backup container:

```text
YYYYMMDDTHHMMSSZ/
  postgres.dump
  uploads.tar.gz
  manifest.txt
```

Included:

- PostgreSQL custom dump from `pg_dump --format=custom`
- uploads and branding files from the upload volume
- manifest with creation timestamp and database name

Not included:

- `.env`
- reverse-proxy configuration
- container logs
- temporary files
- Docker secret volume content

Important: the generated encryption key lives in the Docker volume `heidekoenig_secrets`. If SMTP
passwords are encrypted in the database, this volume must be protected by the operator's server
backup policy. Without the key, encrypted SMTP passwords must be re-entered.

## Manual Backup

Run from the production app directory:

```bash
cd <APP_DIR>
docker compose --profile backup run --rm backup
```

Expected result:

```text
Backup completed: /backups/YYYYMMDDTHHMMSSZ
```

Verify on the host:

```bash
sudo find /mnt/heidekoenig-backups -maxdepth 2 -type f -print
```

## Retention

The backup script removes timestamped backup directories older than:

```env
BACKUP_RETENTION_DAYS=30
```

The retention cleanup runs at the end of every backup job.

## Scheduled Backup

Use host cron or a systemd timer on the production server. Example cron:

```cron
0 3 * * * cd <APP_DIR> && docker compose --profile backup run --rm backup
```

Do not use the current dev path in production.

## Restore Preconditions

Before restoring:

1. Confirm the backup timestamp.
2. Stop the app.
3. Confirm downtime is accepted.
4. Confirm you are on the intended environment.
5. Prefer testing restore on a non-production copy first.

## Restore Command

Restore database and uploads from a timestamped backup directory:

```bash
cd <APP_DIR>
docker compose stop app
docker compose --profile backup run --rm --entrypoint /bin/sh backup /scripts/restore-postgres.sh /backups/<timestamp>
docker compose up -d
```

Example:

```bash
docker compose --profile backup run --rm --entrypoint /bin/sh backup /scripts/restore-postgres.sh /backups/20260525T030000Z
```

The restore script:

- uses `pg_restore --clean --if-exists`
- replaces existing upload files with the archived uploads
- requires `postgres.dump` and `uploads.tar.gz`

## Restore Test

Recommended cadence:

- after first production setup
- after schema migrations
- quarterly

Use a separate test host or a separate compose project name. Never run a restore test directly over
a working production instance unless downtime and data overwrite are intended.

## Security

Backups contain personal reservation data. Restrict access to:

- the NAS export
- the host mount path
- Docker permissions on the production server
- offsite copies, if any

Never expose backup files through the reverse proxy.
