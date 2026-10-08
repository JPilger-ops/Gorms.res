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
- special-request policy notes are stored as manual review reasons, for example
  `Sonderwunsch erkannt: Gast wünscht A-/B-Tisch A1. Diese Tische können grundsätzlich nicht reserviert werden.`
  or `Anfrage ab 30 Personen: Anzahlung in Höhe von 100 € erforderlich.`
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

Stores installation-wide settings: setup completion, legacy host-import marker and audit retention.
Unknown legacy settings are retained; recognized venue settings are moved by migration 0003.

### `venues`, `venue_hosts`, `venue_settings`

Venues have stable UUID identity, unique slug, names, timezone, strategy and active flag.
Hosts use unique normalized ASCII keys. Venue settings use `(venue_id, key)` as primary key;
SMTP passwords remain encrypted. Requests, blocked dates and independent event days require venue
foreign keys. Blocked-day uniqueness is per venue/date. Snapshot and mail ownership is derived only
through the reservation, not duplicated.

See [Multi-Venue Foundation](multi-venue.md) for exact forward-only migration/backfill and verification.

### `audit_log`

Stores security and administration events with optional venue context. Global security/user events
keep a null venue. Reservation-related audit metadata is scrubbed by
retention cleanup when the related reservation request is older than the configured reservation
retention value. Audit-log rows older than the configured audit retention value are deleted.

## Telegraph Table Plan (Migration 0004)

Migration `0004_telegraph_table_plan` adds seven tables: `venue_areas`, `physical_tables`,
`table_layouts`, `table_combinations`, `table_combination_members`, `area_plan_layouts`
and `floorplan_assets`. No reservation or availability tables are changed. Telegraph is
bootstrapped with stable UUID, TABLES strategy and Gastraum; identity conflicts abort the
transaction instead of overwriting another venue.

Partial case-insensitive indexes reserve names only while unarchived. Composite area FKs
protect combination members and floorplan references. Deferred cross-row triggers enforce
two distinct members and the capacity sum at commit, allowing atomic coordinated edits.
Deactivating/archiving members does not invalidate combinations or remove history.
Area revisions are locked/compared for every structural save. See [Table Plan](table-plan.md#schema).
Preserve old migration files; Drizzle snapshots do not model the custom constraint triggers.

## Reservation Status Values

- `pending`
- `accepted`
- `declined`
- `cancelled`

The normal V1.1 workflow changes status through acceptance and decline e-mails after successful SMTP
delivery. A controlled manual override exists as a special case and requires an audit reason.
