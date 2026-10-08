# Multi-Venue Foundation: Phases 1 And 2

## Scope

Heidekönig remains the only publicly released booking venue. Its stable ID is
`00000000-0000-4000-8000-000000000001`, slug `heidekoenig`, timezone `Europe/Berlin`
and availability strategy `CAPACITY`. Phase 2 also seeds Telegraph for its admin-only
table-plan editor, without public hosts or a TABLES availability engine.
`TABLES` availability fails explicitly; it never falls back to CAPACITY.
The existing navigation, guest form and manual decision workflow remain in use.

## Ownership

- `venues`: identity, name/short name, timezone, strategy and active flag. No guest data.
- `venue_hosts`: globally unique, normalized ASCII hostname pointing to one venue.
- `venue_settings`: primary key `(venue_id, key)`; business rules, mail/SMTP, branding,
  privacy and reservation retention. SMTP ciphertext remains AES-256-GCM encrypted.
- `reservation_requests`, `blocked_days`, `reservation_events`: required venue foreign key.
  Blocked dates are unique per `(venue_id, date)`, not across the installation.
- Availability snapshots and outgoing mails inherit ownership through their reservation FK.
  They intentionally have no redundant `venue_id`.
- Events are independent calendar/event days, NOT reservation events. There is no
  event-to-reservation relation and therefore no competing source of venue ownership.
- `audit_log.venue_id` is optional. Venue operations carry a venue; authentication,
  users, setup and system/security operations remain global.
- Users, roles and sessions are global. Current authorized staff can select every supported
  active venue; this phase does not introduce per-venue account permissions.

Server domain functions require an explicit `VenueContext`. Detail reads, mutations, snapshots,
AI requests, ICS downloads and mail history check the reservation ID AND its venue.
Unknown IDs from a different venue cannot cause an AI request or SMTP send.
The existing CAPACITY algorithm is wrapped by a central strategy guard, not rewritten.

## Upgrade And Migration

`0003_multi_venue_foundation.sql` is forward-only. Earlier SQL migrations are unchanged.
Drizzle applies DDL/backfill/settings transfer in its migration transaction:

1. Create the venue tables and seed Heidekönig.
2. Add nullable ownership columns, backfill all existing requests/days/events to Heidekönig,
   then enforce NOT NULL and foreign keys. Preserve existing IDs, content, status and timestamps.
3. Copy recognized business, SMTP, branding and privacy settings into `venue_settings`,
   preserving value/ciphertext, secret flag, editor and timestamp. Remove the transferred global
   entries within that same transaction. Unknown settings are left untouched.
4. Add venue context to existing venue-related audit rows without changing their metadata.
5. Add scoped indexes and replace the global blocked-date uniqueness constraint.

All supported migration commands invoke `scripts/migrate.mjs`:

```bash
npm run db:migrate
npm run db:migrate:runtime
# On the target server, after a separately verified backup:
docker compose exec app node scripts/migrate.mjs
```

The runner then imports the CURRENT `PUBLIC_ALLOWED_HOSTS` once into `venue_hosts`, assigning
Unicode/Punycode aliases and additional legacy aliases to Heidekönig. The import and
`app_settings.venue_hosts_legacy_import_completed=true` marker are a separate transaction
protected by an advisory lock. A conflict or invalid/admin host rolls back the entire import;
the runner exits unsuccessfully and can be rerun after fixing configuration. Successfully
applied SQL does not need to be undone. No marker is set on failure.

After completion, rerunning migration does NOT overwrite or extend host assignments from ENV.
Adding an ENV host later alone is insufficient. Do not use `db:push` or direct `drizzle-kit migrate`
for deployment: these bypass the supported import runner.

## Hosts And Domains

A public hostname must be in `PUBLIC_ALLOWED_HOSTS` AND mapped in `venue_hosts` to an active venue.
Unicode and Punycode normalize to one ASCII key. Unknown, unassigned or inactive mappings fail
closed. `X-Forwarded-Host` keeps precedence over `Host`; the trusted reverse proxy must sanitize
forwarded headers. Direct access to the app port must remain firewall-restricted.

Origin must belong to the same venue; another venue's otherwise valid public host is NOT accepted.
Admin hosts remain a separate allowlist and cannot be assigned by the public-host CLI.
Production admin and venue-preference cookies remain host-only, HttpOnly, Secure and SameSite=Lax.

To add an alias, first add it to the target deployment's `PUBLIC_ALLOWED_HOSTS`, configure DNS/NPM,
and recreate the app with that ENV. Then run on that server:

```bash
docker compose exec app node scripts/venue-hosts.mjs heidekoenig 'alias.example.org'
# Development equivalent:
npm run venue:hosts -- heidekoenig 'alias.example.org'
```

The CLI only adds mappings. It rejects unknown venues, admin hosts, non-allowlisted hosts and
reassignment to another venue. Existing identical assignments are idempotent. Removal/reassignment
is intentionally not exposed in the GUI; an operator must make a reviewed database change and
update the ENV/proxy accordingly. Public aliases still resolve without any admin cookies.

Admin context is explicit in `?venue=<UUID>`; the host-only cookie is only a start preference,
never authorization. Admins select active CAPACITY/TABLES venues; employees select CAPACITY only.
The menu appears when multiple supported venues exist. Forms carry their rendered venue ID;
actions compare it with the URL-resolved context. Tabs remain independent despite cookie changes.
Missing/manipulated or contradictory form context fails closed. Permissions are still checked.

Public pages, privacy settings, metadata and branding use the resolved venue. Existing
`/branding/logo` and `/branding/favicon` URLs and UUID filenames remain unchanged. Admin branding
uses the explicit query-selected venue after login; pre-login branding uses Heidekönig. Asset responses are
not cached across selections. The upload directory and backup archive structure are unchanged.

## Settings And Retention

Global settings: setup status, host-import marker and audit-log retention.
Deployment settings: database/session/encryption secrets, Ollama switches/endpoint and backups.
Venue settings: reservation/business rules, SMTP, subjects/recipients, branding, privacy/contact
and reservation retention. Existing ENV fallbacks are retained for Heidekönig only. In particular,
another venue NEVER inherits Heidekönig's ENV SMTP user/password/from address or recipient.

Reservation retention resolves independently for each venue:

1. Positive integer venue database value.
2. For Heidekönig only: its existing `RESERVATION_RETENTION_DAYS` ENV fallback.
3. Otherwise 30 days.

Invalid/missing DB values keep the fallback behavior. A DB value of 30 remains 30 even if ENV is 90.
Audit retention of 90 never becomes reservation retention. No retention default is changed to 90
by migration. Existing anonymization (not deletion) of request contacts, mail history and audit
metadata remains. Both server cleanup and runtime CLI use `scripts/retention-lib.mjs` and include
inactive venues. Admin manual cleanup scopes reservations to the selected venue; expiry of global
audit rows remains installation-wide. Retention still uses elapsed days since request creation.

## Timezone Corrections

Calendar dates remain ISO date-only values. Date ranges and weekdays use calendar arithmetic,
not browser/server-local midnight. "Today" and past-date checks use the venue timezone.
The guest form receives today's venue date from the server. NRW holidays use `DE` + `NW`
(`NRW` is normalized), with checks made within the venue's local holiday day.

Internal request/confirmation ICS uses venue-local time converted explicitly to UTC. Authorized
behavior difference: Berlin 14:00 in June is 12:00Z; in January it is 13:00Z. UID, two-hour duration,
TENTATIVE/CONFIRMED status and internal-only attachments remain unchanged. Ambiguous/nonexistent DST
wall times are rejected rather than silently shifted. Default reservation hours do not include them.
Admin calendar dates no longer depend on the server timezone; operational timestamp labels use Berlin.

## Verification

Install dependencies with Node 22. The Docker integration launcher also needs `openssl` on the host
to generate temporary, one-day SMTP test certificates (not deployment certificates), then:

```bash
npm run test:venue-foundation
npm run test:multi-venue
# Optional real Next/Playwright smoke, with the installed Playwright browser image:
MULTI_VENUE_WEB_TEST=true MULTI_VENUE_TEST_IMAGE=mcr.microsoft.com/playwright:v1.56.1-noble npm run test:multi-venue
npm run test:ai-validation
npm run test:special-requests
npm run lint
npm run typecheck
npm run format:check
npm run build
git diff --check
```

The integration launcher creates a uniquely named internal Docker network and disposable PostgreSQL
17 database in tmpfs, publishes NO DB port, mounts NO deployment/NAS/secrets volume, ignores the
operator `.env`, and cleans containers/network/certificates on exit. It checks its dedicated database URL before
destructive fixture operations. SMTP tests use in-process local sinks with AUTH PLAIN/LOGIN,
STARTTLS on 587 and implicit TLS on 465. Only the generated trusted certificate is added to the
test process CA store; a second untrusted certificate must fail before AUTH. No SMTP port is
published, no message is relayed, and no real guest mails or Ollama calls occur.
Browser tests build/start only an isolated verification process on port 6143
inside its test container; they do not deploy or recreate Compose services.

Coverage: V1.1 upgrade/new install, exact backfill and ciphertext preservation, host rollback/retry/
idempotence, six retention fallback variants, two-venue isolation, TABLES rejection, CAPACITY golden
cases and real PostgreSQL HH:MM:SS/fractional times without a custom pg parser, four server timezones,
midnight/DST/holidays/ICS, SMTP/MIME compatibility, mail-first/status-second and cleanup including
inactive venues. Optional smoke covers real host/origin/forwarded routing, foreign details/ICS,
branding, stale forms, conditional selector and desktop/mobile overflow.
Browser screenshots are written to ignored `build/phase1-verification` and contain only synthetic
test data. The temporary server and database are stopped at the end.

## Known Boundaries

- The separately approved correction fixes the original dependency findings except the five
  unpatched `braces` tooling-chain entries. The full audit is NOT clean. See
  [Security](security.md#dependency-security-correction) and the [correction report](phase-1-correction-report.md).
- The separately approved CAPACITY correction accepts HH:MM, PostgreSQL HH:MM:SS and up to six
  fractional-second digits in minute conversion. Seconds are preserved, with no timezone parsing
  or truncation. Public/settings time validation stays HH:MM; overlap comparisons, occupancy
  duration, venue/status/date filters, limits and nonblocking capacity warnings are unchanged.
  Existing requests now contribute to occupancy; previously missed warnings can appear. Old
  availability snapshots remain historical and are NOT recalculated. No new migration is needed.
- Additional public venues are not released by these phases. Existing public wording and special-request
  policy content still describe Heidekönig's indoor/deposit/table rules. Configure/review a dedicated
  policy and public copy before enabling another venue. Telegraph receives only the structural
  editor documented in [Table Plan](table-plan.md), with migration 0004; no booking behavior.
- The existing possibility of concurrent decision mails is not changed: optimistic status checks
  prevent overwriting a changed status, but cannot unsend a delivered mail.
- Retention continues preserving availability snapshots and their prior rule notes. Their established
  retention policy and possible personal context require separate review; no new copies are created.
- Migration needs normal DDL locks and a tested backup. Large production row counts/lock duration
  and a real target-server restore were not assessed by disposable test fixtures.
- Protect the encryption key independently. DB/upload backups alone cannot decrypt migrated SMTP
  ciphertext after loss of `/app/secrets/app_encryption_key` or the ENV key.

No commit, push or deployment is part of this phase's verification.
