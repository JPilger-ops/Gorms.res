# Database

## ORM And Migrations

The app uses Drizzle ORM with PostgreSQL. Schema definitions live in `db/schema.ts`; migrations live
in `db/migrations`.

Generate migrations during development:

```bash
npm run db:generate
```

Run migrations in Docker:

```bash
docker compose exec app node scripts/migrate.mjs
```

Automatic startup migrations are disabled by default and require:

```env
RUN_MIGRATIONS_ON_START=true
```

## Tables

### `reservation_requests`

Stores only data required to process the request:

- requested date and time
- guest name, e-mail, phone
- guest count
- optional message
- status
- privacy acknowledgement timestamp
- created/updated timestamps

Retention cleanup anonymizes old rows instead of deleting the operational shell. Date, time, guest
count and status remain for operational reporting; guest name, e-mail, phone and message are
removed or replaced with neutral placeholders.

### `reservation_availability_checks`

Stores the rule result captured when a reservation request is created:

- availability status: `bookable`, `manual_review`, `capacity_warning`, `blocked`
- hard-block flag
- blocking reasons, warnings, manual review reasons
- special-request categories are stored as manual review reasons, for example
  `Sonderwunsch erkannt: Tisch-/Platzwunsch.`
- accepted/pending guests in the checked occupancy window
- requested guest count and configured capacity
- window start/end, latest reservation time and season

This table is a snapshot. It keeps staff decisions understandable even if settings change later.

### `reservation_outgoing_emails`

Stores reservation-related outgoing e-mails for the admin detail workflow:

- mail type, recipient, subject and body
- SMTP status and optional sanitized error
- send timestamp and optional sending user

Retention cleanup anonymizes recipient, subject, body and SMTP error text when the related
reservation request is older than the configured reservation retention value.

### `reservation_events`

Stores operational events such as music evenings. Events with `reservations_allowed=false` block
public reservation requests for the event date and can expose a public note.

### `blocked_days`

Stores manually blocked calendar dates and an optional reason.

### `users`

Stores admin and employee accounts:

- e-mail
- name
- password hash
- role
- active flag
- optional last login timestamp

### `sessions`

Stores server-side session token hashes and expiry timestamps.

### `app_settings`

Stores editable application settings. Secret values are encrypted before storage.

### `audit_log`

Stores security and administration events. Reservation-related audit metadata is scrubbed by
retention cleanup when the related reservation request is older than the configured reservation
retention value. Audit-log rows older than the configured audit retention value are deleted.

## Reservation Status Values

- `pending`
- `accepted`
- `declined`
- `cancelled`

The normal V1.1 workflow changes status through acceptance and decline e-mails after successful SMTP
delivery. A controlled manual override exists as a special case and requires an audit reason.
