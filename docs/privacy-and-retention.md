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

## Cleanup And Anonymization

Manual cleanup:

```bash
docker compose exec app node scripts/cleanup-reservations.mjs
```

The cleanup anonymizes old reservation requests according to the configured reservation retention
value. It keeps requested date, time, guest count, status and operational timestamps, but removes
personal fields:

- guest name is replaced with `Anonymisiert`
- e-mail and phone are replaced with neutral placeholders
- optional message is deleted
- related outgoing e-mail recipient, subject and body are anonymized
- related SMTP error text is removed
- reservation-related audit metadata is scrubbed to remove operational reasons or context that may
  contain personal details

Audit-log entries older than the configured audit retention value are deleted.

## Audit Logs

Audit logs should not contain personal reservation details. They track security and administration
events such as login attempts, user changes, SMTP changes and retention cleanup.

## Backups

Backups include personal data and must be protected with restricted NAS permissions. Do not expose
backup folders through the reverse proxy.
