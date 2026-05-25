# Database Security

## Network Exposure

PostgreSQL is only attached to the internal Docker network. The compose file does not publish port
`5432`.

Expected access path:

```text
app container -> internal Docker network -> db container
```

The reverse proxy must never route to PostgreSQL.

## Credentials

Database credentials come from `.env` and are injected into Docker Compose. `.env` must not be
committed.

Minimum required value:

```env
POSTGRES_APP_PASSWORD=...
```

## Data Minimization

Reservation records exclude long-lived IP addresses, user agents, tracking IDs and marketing
metadata. Rate-limit data is in-memory and short-lived.

## Secret Values

SMTP passwords stored in `app_settings` are encrypted before database storage. The encryption key is
outside the database and must be protected separately.

## Backup Sensitivity

Database backups include personal reservation data. Backup storage must be restricted to server
administrators and must not be served by the reverse proxy.
