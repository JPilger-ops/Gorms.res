# Security

## Host Separation

The app is hostname-aware:

- Public hosts: `heidekönig.gorms.de`, `xn--heideknig-57a.gorms.de`
- Admin host: `login.gorms.de`

Public actions are accepted only on public hosts. Admin, login and setup actions are accepted only on the admin host.

Server-side checks validate both:

- request host / forwarded host
- `Origin` header when present

Reverse-proxy blocks are still recommended as an additional security layer.

## Rate Limiting

The app applies in-memory rate limits to:

- reservation requests
- login attempts
- setup attempts
- SMTP test mails

Rate-limit keys are hashed before storage. Raw IP addresses are not persisted.

## Honeypot

The public reservation form contains a hidden honeypot field. Submissions with this field filled are rejected by schema validation.

## Authentication

- Passwords are hashed with Argon2id.
- Sessions are stored server-side.
- Session cookies are HTTP-only.
- Cookies are host-only and must not use `.gorms.de`.
- Disabled users cannot log in.
- Password resets invalidate existing sessions of the affected user.

## Audit Log

Security-relevant actions are recorded without personal reservation details:

- successful login
- failed login
- login rate limit
- setup failures
- setup rate limit
- user and role changes
- SMTP settings updates
- branding changes
- retention cleanup
- manual reservation status overrides with required reason

Reservation-related audit metadata is scrubbed by retention cleanup after the configured reservation
retention period. Audit logs older than the configured audit retention period are deleted.

## Security Headers

The app sets baseline headers through Next.js:

- `Content-Security-Policy`
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy`
- `Permissions-Policy`

## Secrets

SMTP passwords are encrypted before database storage. The encryption key is either:

- supplied by `APP_ENCRYPTION_KEY`, or
- generated into `/app/secrets/app_encryption_key`

The generated key is stored in the Docker volume `heidekoenig_secrets`. Losing this volume means encrypted SMTP passwords must be re-entered.

## Multi-Venue Boundary

Public access requires both ENV allowlisting and an active DB hostname-to-venue assignment.
Origin must resolve to that same venue. Reservation IDs are always checked with their venue before
detail reads, changes, ICS, AI or SMTP operations. Admin selection is host-only and cannot replace
role checks; stale form context is rejected. Venue SMTP secrets remain encrypted and are not
inherited from another venue's ENV credentials. See [Multi-Venue Foundation](multi-venue.md).

## Dependency Security Correction

The separately approved Phase 1 correction updates Next/ESLint to 16.3.8 and Nodemailer to 10.0.9,
with compatible, pinned transitive fixes. The original Phase 1 audit reported 17 package findings
(1 critical, 13 high, 2 moderate, 1 low). The corrected lockfile retains FIVE HIGH tooling findings:
`eslint-config-next -> @next/eslint-plugin-next -> fast-glob -> micromatch -> braces`.

These are documented exceptions for [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm),
not five independent vulnerabilities. `braces` 3.0.3 has no published fix as of 2026-10-08. Do not use
`npm audit fix --force`, downgrade ESLint to Next 14, create a local fork, or suppress all high findings.
Review this exact advisory/chain at the next dependency update and before release; any new finding
requires its own assessment. Guest data does not reach these tooling glob patterns. Repository and
CI inputs remain a trust boundary. The image currently includes devDependencies, so tooling packages
are present even though they are not used by the guest request handlers.

The full audit is NOT clean. `npm audit --omit=dev` checks the runtime dependency graph separately;
it does not certify the entire image or application. See the [correction report](phase-1-correction-report.md)
for all 17 findings, exact versions, regression evidence, SMTP compatibility and remaining risks.
Functional tests are not a security certification or proof of exploitability/non-exploitability.

SMTP behavior is preserved: port 465 uses implicit TLS; other ports negotiate STARTTLS when offered.
Certificate verification remains enabled. This correction does not add `requireTLS`, so non-465
connections still permit a server that does not advertise STARTTLS. Operators should use an SMTP
provider offering verified TLS/STARTTLS; a stricter transport policy needs a separate reviewed change.

## Admin Table Plan Security

TABLES structures/floorplans require admin capability, active session and matching URL-bound venue
and area. Employees and CAPACITY venues cannot access them. Incoming internal `x-gorms-*` context
headers are removed by the request adapter; every action/handler still authorizes independently.
Multipart saves additionally check exact Origin scheme/authority/port, bounded streaming input and
per-user rate limits. Private PNG/data/error responses are no-store.
Local Next image-optimizer paths are denied so private images cannot enter a shared optimization
cache. Existing public/branding image delivery uses direct URLs and is unchanged.

Sharp validates signatures/full decode/orientation/dimensions and strips metadata. SVG, PDF,
animated images and user-controlled paths are forbidden. The UUID-only floorplan namespace rejects
symlink components; current DB references prevent cleanup irrespective of age or archived state.
Shared save/backup and exclusive cleanup locks coordinate file removal. Unexpected DB uncertainty
stops cleanup. Audit writes contain only resource IDs, revisions, counts and change categories.

These checks do not replace trusted reverse-proxy header sanitization, restricted Docker/volume
access, a secure NAS or backup rehearsal. Known braces tooling exceptions remain unchanged; adding
Konva and making the existing Sharp version explicit does not make the full audit clean.
See [Table Plan](table-plan.md) and [Phase 2 Report](phase-2-table-plan-report.md).
