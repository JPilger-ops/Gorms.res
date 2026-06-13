# Current Live Status

This document records the current debug deployment snapshot. It is not a substitute for the
production cutover checklist; it captures the known-good state before moving to a later production
server.

## Snapshot

```text
Date:                         2026-06-13
Deployment checkout HEAD:     a6e75a2
Last rebuilt app image commit: ac90f9e
Deployment path:              /opt/app/Gorms.res
App port:                     6043
Public host:                  xn--heideknig-57a.gorms.de
Admin host:                   login.gorms.de
```

The app container image currently running was rebuilt during the dependency hardening deploy at
`ac90f9e`. The commits after that are documentation-only commits and do not require a container
rebuild.

## Runtime Health

```text
heidekoenig-app healthy 0.0.0.0:6043->6043/tcp
heidekoenig-db  healthy 5432/tcp internal Docker network only
```

Runtime versions:

```json
{ "next": "16.2.9", "react": "19.2.7", "postcss": "8.5.15" }
```

Startup log:

```text
Startup status: setup completed, app is ready.
```

## Security And Dependency Status

`npm audit` on the deployment checkout reports:

```text
0 vulnerabilities
```

Host routing is still enforced by the app and reverse proxy:

```text
https://xn--heideknig-57a.gorms.de/       -> 200
https://login.gorms.de/login              -> 200
https://login.gorms.de/admin              -> 307 to /login without session
https://xn--heideknig-57a.gorms.de/admin  -> 404
https://login.gorms.de/reservieren        -> 404
```

## Database Snapshot

Counts only, without printing personal reservation details:

```text
audit_log                   33
blocked_days                 1
reservation_outgoing_emails  6
reservation_requests         5
sessions                    13
users                        1
```

## Backup Snapshot

NFS mount:

```text
192.100.100.152:/mnt/Vault/Backups/Backup_Gorms.Res -> /mnt/heidekoenig-backups
```

Backup container UID/GID:

```text
3007:3009
```

Latest backup manifest observed:

```text
/backups/20260613T084846Z/manifest.txt
created_at=20260613T084846Z
postgres_db=heidekoenig
postgres_user=heidekoenig_app
uploads_archive=uploads.tar.gz
database_dump=postgres.dump
retention_days=30
```

## Verified Functional Flows

- Public reservation request submission.
- Staff notification e-mail with internal request `.ics`.
- Guest request receipt e-mail.
- Admin login.
- Admin reservation detail view.
- Manual decline workflow.
- Persistent success feedback after manual decline.
- Local Ollama draft generation when enabled, with draft-only guardrails.
- NFS backup and non-production restore test.

## Remaining Before Production Cutover

- Confirm final production app host IP.
- Confirm reverse proxy source IP for the firewall allow rule.
- Confirm production repository path.
- Recreate the NFS mount on the production host.
- Configure production `.env` and keep it out of Git.
- Run migrations on the production database.
- Complete setup wizard or restore intended production data.
- Configure SMTP and send a test mail.
- Run routing, backup and live workflow smoke tests on the production host.
- Hand over admin credentials outside Git and chat logs.

Use [Production Cutover Checklist](production-cutover.md) for the actual move.
