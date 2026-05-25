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

Stores security and administration events without reservation personal details.

## Reservation Status Values

- `pending`
- `accepted`
- `declined`
- `cancelled`

Version 1 displays the status but does not require in-app confirmation workflows.
