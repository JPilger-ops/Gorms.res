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

Public form, slot and login rate limits use short-lived in-memory keys derived from a truncated hash
of proxy connection data. These keys are not written to the reservation database.

## Public Privacy Notice

Guests must acknowledge the privacy notice before submitting a request. The notice text and optional
privacy/imprint links are configurable by admins.

The public privacy banner stores only the banner acknowledgement in the guest browser. It does not
track the guest, expires after 180 days and is asked again after expiry.

## Retention Defaults

```env
RESERVATION_RETENTION_DAYS=30
AUDIT_LOG_RETENTION_DAYS=90
BACKUP_RETENTION_DAYS=30
```

Admins can update reservation retention per selected venue and audit retention globally. Migration
preserves existing reservation retention (including a DB value of 30 despite ENV 90). Missing/invalid
values retain the Heidekönig ENV fallback or the existing default of 30; audit 90 is never reused.

## Cleanup And Anonymization

Manual cleanup:

```bash
docker compose exec app node scripts/cleanup-reservations.mjs
```

The runtime cleanup iterates every venue, including inactive venues, and anonymizes old reservation
requests according to each venue's retention. The server and runtime CLI share one implementation.
Manual admin cleanup scopes request/mail anonymization to the selected venue; expired global audit
entries are still deleted installation-wide. It keeps requested date, time, guest count, status and operational timestamps, but removes
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

SMTP transport errors stored in the outgoing e-mail history are deliberately generic. Raw provider
errors are not persisted because they can contain operational details or parts of a submitted message.

## Local AI Drafts

The optional Ollama integration is a draft assistant only. It receives the minimum reservation
context needed to prepare an editable response draft, cannot send e-mails and cannot decide a
reservation status automatically.

## Backups

Backups include personal data and must be protected with restricted NAS permissions. Do not expose
backup folders through the reverse proxy.

## Phase 1 Review Boundary

Venue tables store only ownership/configuration, not copies of guest data or AI output. The existing
anonymization behavior and backup retention are unchanged. Availability snapshots retain their
existing rule notes; any residual personal context in those notes needs separate review. See
[Multi-Venue Foundation](multi-venue.md) for tests and remaining limitations.
