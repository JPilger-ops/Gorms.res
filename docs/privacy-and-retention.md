# Privacy And Retention

## Data Minimization

Reservation requests store only:

- guest name
- e-mail address
- phone number
- requested date and time
- guest count
- optional message
- privacy acknowledgement timestamp
- status and timestamps

The app does not persist full IP addresses, user agents, tracking IDs, location data, analytics IDs
or marketing preferences.

## Public Privacy Notice

Guests must acknowledge the privacy notice before submitting a request. The notice text and optional
privacy/imprint links are configurable by admins.

## Retention Defaults

```env
RESERVATION_RETENTION_DAYS=30
AUDIT_LOG_RETENTION_DAYS=90
BACKUP_RETENTION_DAYS=30
```

Admins can update reservation and audit retention values in the admin panel.

## Cleanup

Manual cleanup:

```bash
docker compose exec app node scripts/cleanup-reservations.mjs
```

The cleanup deletes old reservation requests and old audit-log entries according to configured
retention values.

## Audit Logs

Audit logs should not contain personal reservation details. They track security and administration
events such as login attempts, user changes, SMTP changes and retention cleanup.

## Backups

Backups include personal data and must be protected with restricted NAS permissions. Do not expose
backup folders through the reverse proxy.
