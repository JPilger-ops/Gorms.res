# NFS Backup

## Scope

The NAS share is mounted on the production Docker host. The app does not mount NFS itself. Docker
bind-mounts the already-mounted host directory into the app and backup containers.

This gives the containers write access to:

```text
/backups
```

while the production host owns the actual NFS mount at:

```text
/mnt/heidekoenig-backups
```

## Current NAS Values

```text
NAS IP:         192.100.100.152
NAS export:     192.100.100.152:/mnt/Vault/Backups/Backup_Gorms.Res
NAS user:       Gorms
NFS UID/GID:    3007:3009
Host path:      /mnt/heidekoenig-backups
Container path: /backups
```

The NAS-side backup permission should be restricted to the dedicated NAS user `Gorms` and to the
production server IP. The mounted directory is writable for UID/GID `3007:3009`; the Docker backup
service therefore runs with that numeric user. Do not store a NAS password in this repository.

## Environment

Set on the production server in `.env`:

```env
BACKUP_TARGET=nfs
BACKUP_NFS_EXPORT=192.100.100.152:/mnt/Vault/Backups/Backup_Gorms.Res
BACKUP_HOST_PATH=/mnt/heidekoenig-backups
BACKUP_CONTAINER_PATH=/backups
BACKUP_RETENTION_DAYS=30
```

`BACKUP_NFS_EXPORT` documents the export for operators. Docker Compose uses `BACKUP_HOST_PATH` after
the host has mounted the share.

## NAS Preparation

On the NAS:

1. Create the share/export path `/mnt/Vault/Backups/Backup_Gorms.Res`.
2. Restrict write access to the production Docker host IP.
3. Restrict account-level permissions to the NAS user `Gorms`.
4. Disable guest/public access.
5. Do not expose the backup share through any web service.

## Host Mount

Run on the production Docker host:

```bash
sudo mkdir -p /mnt/heidekoenig-backups
sudo mount -t nfs 192.100.100.152:/mnt/Vault/Backups/Backup_Gorms.Res /mnt/heidekoenig-backups
```

Verify write access:

```bash
sudo touch /mnt/heidekoenig-backups/.write-test
sudo rm /mnt/heidekoenig-backups/.write-test
```

Persist the mount in `/etc/fstab` only after a manual mount and backup test succeeded. Example:

```fstab
192.100.100.152:/mnt/Vault/Backups/Backup_Gorms.Res /mnt/heidekoenig-backups nfs defaults,_netdev,nofail 0 0
```

Then verify:

```bash
sudo mount -a
findmnt /mnt/heidekoenig-backups
```

## Docker Access

The compose file binds:

```text
${BACKUP_HOST_PATH:-/mnt/heidekoenig-backups}:${BACKUP_CONTAINER_PATH:-/backups}
```

The backup container writes timestamped backup directories below `/backups`. The app container also
has the path available for setup/system checks.

The backup service runs as:

```yaml
user: "3007:3009"
```

This matches the current NAS-side ownership of the NFS export.

## Manual Backup

Run from the production app directory:

```bash
cd <APP_DIR>
docker compose --profile backup run --rm backup
```

## Scheduled Backup

Use host cron or a systemd timer. Example cron:

```cron
0 3 * * * cd <APP_DIR> && docker compose --profile backup run --rm backup
```

`<APP_DIR>` should be the production repository path, for example
`/opt/heidekoenig-reservations`.

## Retention

Backups older than `BACKUP_RETENTION_DAYS` are deleted by the backup job. Default:

```env
BACKUP_RETENTION_DAYS=30
```

## Restore

Stop the app before restore:

```bash
cd <APP_DIR>
docker compose stop app
```

Restore database and uploads:

```bash
docker compose --profile backup run --rm --entrypoint /bin/sh backup /scripts/restore-postgres.sh /backups/<timestamp>
```

Start the app again:

```bash
docker compose up -d
```

Run restore tests on a non-production copy of the stack.

## Security

Backups contain personal data from reservation requests. Restrict NAS access to server
administrators only.

Do not:

- expose the backup path through the reverse proxy
- sync backups to insecure public cloud folders
- store `.env` files in app-created backups
- give write access to broad network groups
- test restore over production unless data overwrite and downtime are intended
