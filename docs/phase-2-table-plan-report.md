# Phase 2: Telegraph Table Plan Report

Date: 2026-10-08. Scope: the approved replacement Phase 2 plan, including its six
clarifications. Existing uncommitted Phase 1/1.1 work was retained. No commit,
push, deployment, production database/NAS access, operator .env access, Ollama
request or real guest-mail delivery was performed. Tests use synthetic data only.

## Implementation

Migration `0004_telegraph_table_plan.sql` and Drizzle snapshot/journal introduce
seven structural tables and deterministically bootstrap Telegraph/Gastraum.
Previous migrations remain unchanged. Conflicting IDs/slugs abort the full DDL
transaction and are safely retryable after correcting the conflict. Existing
Heidekoenig data is not backfilled, rewritten or assigned new defaults by 0004.

Physical capacity/accessibility and visual geometry are separate. Combinations
use area-bound composite FKs and distinct member keys; deferred integrity checks
require >=2 members and enough aggregate physical capacity at commit. Inactive
and archived members remain counted; their status never makes archival impossible.
Overlapping combinations are allowed. Partial lower(name) indexes permit name
reuse after archival, including area names; restoration conflicts are readable.
Immutable floorplan identity/metadata is DB-protected, with only retirement mutable.

The saved viewer is DOM/CSS/image based. Editing dynamically loads minimal Konva
canvas modules through Next dynamic import, without react-konva or server canvas.
Drafts, pending uploads and bounded undo/redo exist only in memory. Pointer gesture
commits occur on dragend/transformend, not every frame. Native inputs/table list
provide keyboard alternatives; scoped styles reuse the existing design system.

Actual oriented image dimensions determine the plan aspect ratio. A changed ratio
requires a preview/confirmation, uniformly scales/centers the table arrangement
and remains undoable. Cancel keeps the prior state. Bounds use rotated physical
dimensions, preserving circles/squares. Removing the saved image keeps the saved
format. Full-plan saves lock the area, compare baseRevision and commit resources,
layout, image pointer, revision and audit together; HTTP409 retains the draft.

Capabilities restrict the editor to admins of active TABLES venues. Admin context
is explicit in URL queries, links, forms and branding; a cookie is only a start
preference, so tabs are independent. Internal headers are stripped at the request
adapter, while every server entrypoint checks host/session/permission/context and
ownership. Save Origin is checked including scheme/port. Uploads are bounded and
fully decoded, oriented and normalized through the already pinned Sharp version.

Retired/unregistered floorplans are eligible only after 48 hours. Current references
win regardless of age, retired_at or archived area. Unknown DB state prevents
deletion. Save/backup shared locks and cleanup's exclusive lock protect files
through pg_dump and tar. Backup dump/archive/manifest format is unchanged.

## Dependencies

- Added editor-only `konva` 10.7.1, pinned.
- Added direct `sharp` 0.35.5, already pinned by the Phase 1 correction/override.
- No lucide-react, react-konva, canvas or skia-canvas installed.
- Next 16.3.8, React 19.2.7 and Nodemailer 10.0.9 remain at the preceding corrected
  versions. No unrelated package major upgrades or audit-force fixes.
- Local Next guides for proxy, lazy loading, metadata and route handlers were
  consulted before implementing those boundaries.

## Verification

Verification is performed under Node22 with PostgreSQL17 disposable containers,
internal Docker networks, no published DB ports and no deployment volumes.
SMTP checks use local non-relaying fixtures with temporary test certificates.

| Check                                | Result                                                                                                                                                                                                                                                     |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V1.1 upgrade and clean install       | PASS; exact old rows/ciphertext, host import/rollback/retry and two seeded venues.                                                                                                                                                                         |
| Direct Phase 1 -> Phase 2 upgrade    | PASS; all twelve prior tables preserved, DB retention30 over ENV90, both conflicting ID/slug cases roll back, corrected retry and repeat migration safe.                                                                                                   |
| Table-plan database/domain           | PASS; role/venue/area isolation, relational members, capacity bounds, overlapping combos, atomic edits, concurrent save409, archive preservation and name reuse/restoration conflicts.                                                                     |
| Uploads/geometry/history/cleanup     | PASS; PNG/JPEG/WebP, orientation/metadata, malformed/animated/oversized/dimension/path rejection, file-write rollback, stream limit without Content-Length, natural ratio/acknowledgment, exact reload, current refs/archived refs and shared backup lock. |
| Existing CAPACITY/SMTP/ICS/retention | PASS; HH:MM/HH:MM:SS/fractions and golden rules, six retention fallbacks, two-venue isolation, local AUTH/TLS/MIME/ICS and guest-mail-first/status-second.                                                                                                 |
| AI validation and special requests   | PASS; no real Ollama calls, drafts remain manual.                                                                                                                                                                                                          |
| Lint / typecheck / format:check      | PASS under Node22.                                                                                                                                                                                                                                         |
| Next build / Docker Compose build    | PASS; dedicated verification image, dummy required ENV and --env-file /dev/null, no services deployed.                                                                                                                                                     |
| Built image runtime                  | PASS; Node22.23.3, UID1001, native Sharp0.35.5 PNG encode/decode, migrate twice/host import and floorplan CLI against separate disposable PG17.                                                                                                            |
| Full npm audit                       | Exit1, expected FIVE HIGH braces-chain exceptions, no critical/moderate/low; not clean.                                                                                                                                                                    |
| npm audit --omit=dev                 | Exit0, zero runtime-graph findings, not a security certification of the image.                                                                                                                                                                             |
| Shell syntax / git diff --check      | PASS.                                                                                                                                                                                                                                                      |
| Three-engine browser suite           | PASS; Chromium/Firefox/WebKit at 1440/1280/390, raster/canvas pixels, actual drag/one-step undo, touch/property controls, save/upload/409, independent tabs, origin/ownership and optimizer rejection.                                                     |
| Isolated backup and full restore     | PASS; pg_dump, uploads/manifest, UID3007:GID3009, restoration to disposable PG17, byte-identical current floorplans and nonzero status on deliberate backup failure.                                                                                       |

The five HIGH package entries represent the existing advisory chain
`eslint-config-next -> @next/eslint-plugin-next -> fast-glob -> micromatch -> braces`,
GHSA-vfj7-8cjw-p6xm, not five independent flaws. No fix/fork/suppression was added.
The image still includes devDependencies, so the full audit remains relevant.

## Files In Phase 2

This list distinguishes this phase from the pre-existing dirty Phase 1 worktree.
Changes in files shared with Phase 1 extend its context without reverting it.

Domain and metadata:
`db/schema.ts`, `db/migrations/0004_telegraph_table_plan.sql`,
`db/migrations/meta/0004_snapshot.json`, `db/migrations/meta/_journal.json`;
`src/lib/table-plan-types.ts`, `src/lib/table-plan-validation.ts`,
`src/lib/table-plan-geometry.ts`, `src/lib/table-plan-history.ts`;
`src/server/table-plan.ts`, `src/server/table-plan-http.ts`, `src/server/floorplans.ts`.

Admin boundaries:
`proxy.ts`, `src/lib/admin-urls.ts`, `src/lib/venue-capabilities.ts`,
`src/lib/permissions.ts`, `src/server/guards.ts`, `src/server/venues.ts`;
`components/admin/admin-shell.tsx`, `components/admin/admin-nav.tsx`;
`app/admin/layout.tsx`, `app/admin/actions.ts`, `app/admin/page.tsx`, `app/layout.tsx`.
`next.config.ts` denies unused local image optimization to protect private assets.

Explicit venue-preserving reservation links:
`app/admin/reservations/page.tsx`, `app/admin/reservations/[id]/page.tsx`,
`app/admin/reservations/[id]/actions.ts`,
`app/admin/reservations/[id]/ics/[kind]/route.ts`,
`src/server/reservation-ics.ts`, `src/server/reservation-decisions.ts`, `src/server/email.ts`.

Editor routes:
`app/admin/table-plan/page.tsx`, `app/admin/table-plan/actions.ts`,
`app/admin/table-plan/[areaId]/page.tsx`,
`app/admin/table-plan/[areaId]/data/route.ts`,
`app/admin/table-plan/[areaId]/save/route.ts`,
`app/admin/table-plan/[areaId]/floorplan/route.ts`.

Components/styles:
`components/table-plan/area-form.tsx`, `components/table-plan/workspace.tsx`,
`components/table-plan/plan-view.tsx`, `components/table-plan/editor.tsx`,
`components/table-plan/canvas.tsx`, `components/table-plan/resource-fields.tsx`,
`app/globals.css` (new scoped table-plan rules only).

Operations/tests/dependencies:
`scripts/cleanup-floorplans.mjs`, `scripts/floorplan-cleanup-lib.mjs`,
`scripts/floorplan-cleanup-lib.d.mts`, `scripts/backup-postgres.sh`, `Dockerfile`,
`scripts/check-table-plan.ts`, `scripts/check-table-plan-browser.ts`,
`scripts/check-multi-venue.ts`, `scripts/test-multi-venue.sh`,
`scripts/test-table-plan-runtime.sh`, `package.json`, `package-lock.json`.

Documentation:
`README.md`, `docs/table-plan.md`, `docs/multi-venue.md`, `docs/architecture.md`,
`docs/database.md`, `docs/admin-guide.md`, `docs/security.md`,
`docs/backup-and-restore.md`, `docs/reverse-proxy.md`, this report.

## Heidekoenig Regression And Intentional Differences

No public UI/copy, CAPACITY rules/parser, decision templates, AI policy, retention
defaults, SMTP behavior or branding files/URLs were changed by Phase 2. Regression
checks cover their existing behavior and preserve effective retention, encrypted
settings and host mappings through upgrade.

Necessary cross-cutting differences: admin links/forms/redirects and internal
mail/ICS deep-links now carry venue queries; the admin selector includes Telegraph
for admins, with capability-specific navigation. Admin metadata uses that explicit
venue, and redundant root manual favicon tags were removed in favor of the existing
metadata mechanism. Public favicon URLs remain unchanged. ICS UID/time/duration/
status and mail wording/send ordering remain unchanged. No guest ICS was added.
The unused local Next image optimizer is explicitly denied to prevent private
floorplans entering shared caches. Direct guest/branding image URLs remain unchanged.

## Remaining Risks And Boundaries

- No TABLES availability/booking/assignment or Phase3+ feature is implemented.
- Real Telegraph floorplan, capacities, accessibility and layout must be configured
  and reviewed by its operator; screenshots use an artificial room, not a real plan.
- Native browser history can leave an in-memory draft without universal interception;
  normal links, venue forms and unload warn. Save before navigating. No draft persistence
  or automatic merging is claimed.
- Headless browser engines and synthetic touch are not physical iOS/Android testing;
  screen-reader/usability and real-device rehearsal remain necessary.
- Rate limits/one-decode gate are process-local. Multiple app replicas need a reviewed
  shared limiter/resource policy. Limits200 resources and 16 megapixels bound inputs,
  but this is not a load test or security certification.
- Forwarded headers rely on trusted reverse-proxy sanitization and app-port firewall
  restrictions. Protect operator access to DB/Docker/upload volumes.
- Filesystem and DB are not one atomic resource. Failed/uncertain commits retain safe
  orphan files for fail-closed cleanup; immediate deletion is intentionally avoided.
  No unsafe cleanup runs when the DB cannot prove nonreference.
- Backup coordination prevents floorplan deletion races, not all business writes.
  Restore must stop writes/cleanup and preserve the encryption key independently.
  The actual NAS/target-server restore and production DDL lock duration were not tested.
- The daily cleanup schedule is documented but not installed or deployed. Archive
  changes do not imply operational combination availability; Phase3 must derive it.
- Five known HIGH tooling audit exceptions remain. Global accounts still authorize
  supported venues by role; no per-venue account-grant feature was introduced.

## Final Browser And Backup Evidence

The final full run (not engine-filtered) completed the three-engine suite and
backup/restore successfully. It produced 18 viewer/editor screenshots at widths 1440, 1280,
390 (desktop/laptop/mobile): `<engine>-viewer-<width>.png` and
`<engine>-editor-<width>.png`, where engine is chromium/firefox/webkit, in ignored
`build/phase2-verification`, plus three `<engine>-properties-1440.png` captures (21 final images).
They contain synthetic fixtures only. Representative
Chromium mobile, Firefox mobile and WebKit desktop captures were visually inspected:
no control/text overlap or horizontal page overflow; actual oriented room images
and undistorted shapes render. Fixture tables can overlap by design; overlap
does not create membership or booking rules.

The pixel check requires the actual raster's known corner color and nonblank
canvas contents, not merely a canvas element. Saved viewers instantiate no canvas.
Tests cover preview cancel/confirm/undo, real multipart replacement, one full drag
per undo step, actual keyboard ArrowRight selection movement and undo, independent URL contexts/favicon, concurrent409 with draft preservation,
discard/reload, touch controls and clean history navigation. No browser runtime
exceptions were observed. HTTP rejects foreign resources, employee/inactive sessions,
spoofed internal headers, bad Origin including scheme/port and oversized requests.
Image-optimizer requests fail with400 with and without an admin session.

Intermediate checks corrected initial WebKit canvas sizing/drawing, discard
semantics and test synchronization around asynchronous navigation/actions. Final
tests wait for actual raster rendering/action success rather than assuming a fixed
timer or network-idle means completion. The context test fills unchanged HTML
time controls with HH:MM, without changing any Heidekoenig rule/parser.

Backup timestamp `20261008T234313Z` belongs ONLY to the disposable verification DB's
temporary local backup, not the NAS. Dump/archive/manifest were restored to
`gorms_phase2_restore` within isolated PG17; current asset files matched byte-for-byte.
A deliberately invalid /proc destination failed, and the psql lock wrapper returned
nonzero as expected. Its division-by-zero diagnostic is intentional failure
propagation, not an unhandled application error.

Temporary Next process, runners/databases, certificates, upload/backup storage and
internal networks were cleaned by the test traps. Verification Docker images are
build artifacts only. Production preflight/live-workflow scripts, NAS access and
deployment commands were deliberately not run.
