# Development Workflow

## Install

```bash
npm install
```

## Run Locally

```bash
npm run dev
```

The development server listens on:

```text
http://localhost:6043
```

Host-based routing should be tested with local DNS entries or explicit Host headers.

## Quality Checks

```bash
npm run check
```

This runs:

- ESLint
- TypeScript typecheck
- Prettier format check

## GitHub Actions

The repository CI runs on pushes to `main` and on pull requests. It uses Node 22 and checks:

- dependency installation with `npm ci`
- ESLint
- TypeScript typecheck
- Prettier format check
- production build with `npm run build`

CI uses dummy non-production values for required runtime secrets. Real production secrets must be
configured only on the deployment server, not in GitHub Actions for this project.

## Database

Generate migrations:

```bash
npm run db:generate
```

Run migrations in Docker:

```bash
docker compose exec app node scripts/migrate.mjs
```

## Docker Build

```bash
POSTGRES_APP_PASSWORD=dummy \
SESSION_SECRET=12345678901234567890123456789012 \
SETUP_TOKEN=1234567890123456 \
docker compose build app
```

## Git Hygiene

- Do not commit `.env`.
- Do not commit uploaded branding files from runtime volumes.
- Keep migrations reviewed and committed.
- Run `npm run check` before pushing.
