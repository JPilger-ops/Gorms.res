# Telegraph Table Plan: Phase 2

## Scope

This is an admin-only structural editor, not a booking engine. Migration
`0004_telegraph_table_plan` creates Bistrot Telegraph (`TABLES`, `Europe/Berlin`,
UUID `00000000-0000-4000-8000-000000000002`) and its initial Gastraum
(`10000000-0000-4000-8000-000000000001`). Conflicting IDs or slugs abort the
migration transaction; resolve the identity conflict before retrying. No public
hosts, copied SMTP settings or sample requests are created for Telegraph.

Heidekoenig remains CAPACITY. Its public form, rules, mail contents, AI workflow,
retention and branding files are unchanged. TABLES availability still fails
explicitly. Public Telegraph booking, assignment of reservations to tables,
service mode, calendar sync, payments and PWA are not implemented.

## Schema

- `venue_areas`: venue FK, name, sorting, active/online flags, archival timestamp,
  revision and timestamps. Live names are case-insensitively unique per venue.
- `physical_tables`: area FK, stable UUID, name, manually set minimum/maximum
  guests, active/online flags and explicitly selected wheelchair suitability.
- `table_layouts`: visual shape, normalized center/dimensions, clockwise rotation
  and drawing order, separate from logical table properties.
- `table_combinations`: stable UUID, area, name, independently configured capacity,
  flags, wheelchair suitability and archival timestamp.
- `table_combination_members`: distinct table IDs. Composite area FKs prevent
  cross-area membership. Overlapping combinations are allowed.
- `area_plan_layouts`: aspect ratio, optional floorplan pointer, background scale,
  translation and opacity. Its composite FK prevents referencing another area's image.
- `floorplan_assets`: server-generated path, PNG MIME type, oriented dimensions,
  byte count, creation and retirement timestamps. A DB trigger prevents changes to
  image identity/metadata; only retirement can change.

Table and combination names are independently unique per area only while not
archived. Inactive, nonarchived resources retain their name. Archived resources
keep their stable IDs and memberships; a conflicting name must be changed before
restoration. No hard-delete action exists for saved areas/tables/combinations.

Deferred PostgreSQL constraint triggers enforce at least two distinct members
and combination maximum <= the sum of member maximums at transaction commit.
Both old and new areas are checked for SQL moves. Capacities count archived and
inactive members too. There is deliberately no constraint coupling a member's
active state to its combination. Operational usability belongs to Phase 3.
The generated schema snapshot covers tables/indexes/FKs; these cross-row triggers
are maintained in the forward SQL migration, not represented by Drizzle codegen.

## Context And Permissions

Admins can select active CAPACITY or TABLES venues. Employees retain their existing
CAPACITY access and cannot view/edit TABLES structures or private floorplans.
Capabilities control navigation and server-side permissions together.

Admin links and forms carry `?venue=<UUID>` explicitly. The host-only HttpOnly
preference cookie is used only when entering without a venue query. Changing it
in another tab does not change the first tab's URL-bound context. Hidden form
venue IDs must match that URL. Duplicate, inactive, unsupported, foreign or
contradictory contexts fail closed. Global users/sessions/security remain global.
Admin branding and internal reservation/ICS links preserve this explicit context.

`proxy.ts` strips incoming `x-gorms-*` headers and passes the actual request path
to the server adapter. It is not an authorization layer. Every operation still
checks admin host, current active session, role/capability, venue and resource
ownership. Trusted proxies must sanitize forwarded headers; firewall access to
port 6043 remains restricted to the reverse proxy.

## Editor Workflow

1. Select Telegraph and open Tischplan. Create/edit/archive areas through versioned
   server actions; open an area to view its saved plan.
2. Select Bearbeiten to load the editor. The saved viewer uses lightweight DOM/CSS
   and images, without a canvas or Konva instance.
3. Add/select a table. Logical properties and visual geometry have separate controls.
   Combination capacity and wheelchair suitability are explicit, never inferred
   from overlap, geometry or member accessibility.
4. Pointer drag/resize/rotate and keyboard/property controls edit an in-memory draft.
   A complete pointer gesture creates one undo step. History is limited to 50 steps
   and 24 MiB of distinct pending images. No autosave, browser storage or background send.
5. Speichern validates and saves the whole area atomically. Verwerfen fetches the
   latest saved state and leaves the editor open; Schliessen returns to the viewer.
   Internal links, venue-switch forms and page unload warn about dirty changes.
   Browser history navigation is not universally interceptable; save before leaving.

Konva 10.7.1 is dynamically loaded only with the editor. Minimal canvas modules
are imported directly; there is no react-konva, server-side Canvas dependency or
new icon library. Controls reuse Gorms.res buttons, feedback, typography and focus
styles. Native dialog and range/number controls provide keyboard alternatives.
The canvas is supplementary to the selectable table list and geometry controls.

## Geometry And Floorplan Changes

New areas without an image begin at 4:3. An image uses its natural, orientation-
corrected aspect ratio. Centers and widths/heights are normalized independently
to their corresponding plan axes, while bounds checks use physical proportions.
Round/square tables remain round/square, including rotations and aspect changes.

A different aspect ratio with existing tables opens a preview and requires
Proportional uebernehmen. Tables are uniformly scaled and centered, not stretched
independently on X/Y. The preview warns that alignment to the new building needs
checking. Cancel preserves the complete previous draft; undo restores the previous
layout and image. Removing a saved image keeps the last saved aspect ratio.
Removing an unsaved replacement returns to the saved format with uniform transfer.
Server validation rejects unacknowledged format changes, out-of-bounds/invalid
geometry and aspect ratios inconsistent with the decoded image.

## HTTP And Concurrency

- `/admin/table-plan`: area overview and versioned area actions.
- `/admin/table-plan/[areaId]`: saved viewer/editor.
- `/admin/table-plan/[areaId]/data`: authenticated, uncached saved plan.
- `/admin/table-plan/[areaId]/save`: bounded multipart POST of one JSON payload
  and optionally one image. Maximum request 9 MiB, JSON 512 KiB; unknown/duplicate
  parts are rejected. Size is enforced while reading, not just via Content-Length.
- `/admin/table-plan/[areaId]/floorplan?asset=<UUID>`: authenticated, uncached PNG
  only for the area's current pointer. Every URL also carries the venue query.

POST requires an exact same-origin scheme/host/port and is rate-limited to 20
requests/minute per user/process. Local Next image-optimizer paths are denied
(`images.localPatterns=[]`) so private floorplans cannot enter an optimizer cache.
All current app images use direct routes, not next/image. Area actions allow 30/minute.
Existing login,
host, session and application limits remain. Rate limiting is process-local and
must be reconsidered before adding multiple replicas.

For the admin proxy host, allow multipart requests up to 9 MiB (Nginx/NPM
`client_max_body_size 9m;`) and disable caching of authenticated admin routes.
Review any existing NPM limit instead of adding duplicate directives. Keep
public form limits unchanged. The handler enforces its own 9 MiB streaming limit;
Next's existing 10 MiB proxy buffer is sufficient. No proxy is changed by this phase.

The transaction locks the area row and compares `baseRevision`. A stale save
returns HTTP409, without merging or overwriting and with the local draft retained.
The revision covers both area properties and complete plans. Resources may not
move between areas or disappear from a saved plan; archive them instead. Atomic
saves permit coordinated capacity changes and name swaps.

## Uploads And Cleanup

Only PNG/JPEG/WebP, <=8 MiB input, 64..8192 pixels per axis and <=16 megapixels.
Signature, MIME, actual full decode, animation and dimensions are checked. Sharp
0.35.5 (the already pinned version, now a direct dependency) auto-orients, removes
metadata and emits a <=32 MiB PNG. Input filenames/paths are ignored. SVG/PDF and
animated images are rejected. One decode at a time per process limits memory spikes.

Files live at `floorplans/<venueUUID>/<areaUUID>/<assetUUID>.png` inside the existing
upload volume, separate from branding. Files are immutable, mode 0644, directories
0755, readable by the existing numeric backup identity. Path components and files
reject symlinks. The routes never accept a filesystem path from a client.
Audit entries contain IDs, revisions, counts and structural/visual flags, not
names, original filenames, image contents or guest data.

Replace/remove retires the old asset, not immediate deletion. Failed/uncertain
saves leave only safe UUID-namespace orphans for later cleanup. All current DB
pointers win over age, `retired_at`, archived areas or stale flags.

```bash
# Operator-run on the target server, not an automatic migration/startup side effect:
docker compose exec -T app node scripts/cleanup-floorplans.mjs
# Development equivalent (requires the reviewed target DATABASE_URL/UPLOAD_DIR):
npm run floorplans:cleanup:runtime
```

Schedule this bounded, idempotent CLI daily through the operator's scheduler.
It deletes only retired unreferenced metadata/files or proven unregistered UUID
files older than 48 hours. It rechecks references immediately before removal,
ignores unrelated/young/symlink files and fails closed on DB uncertainty. Files
registered but neither referenced nor explicitly retired remain for review.

Cleanup takes exclusive PostgreSQL advisory lock 724186203; saves and the entire
backup take its shared lock. Thus cleanup cannot remove files during pg_dump/tar
or a plan save. It does not lock all business writes or claim a global transactional
DB/filesystem snapshot. Existing backup format and branding paths remain intact.
Restore must stop app writes and cleanup; restore matching DB and upload archive
together, preserve the encryption key separately, then use matching code/migrations.

## Isolated Verification

Use Node 22; Docker and openssl are prerequisites for the launcher:

```bash
npm run test:table-plan
MULTI_VENUE_WEB_TEST=true MULTI_VENUE_TEST_IMAGE=mcr.microsoft.com/playwright:v1.56.1-noble npm run test:table-plan
npm run test:ai-validation
npm run test:special-requests
npm run lint
npm run typecheck
npm run format:check
npm run build
npm audit
npm audit --omit=dev
git diff --check
```

The built-image CLI/native check uses a dedicated verification image, not the
running app. Build with dummy required settings and without loading operator .env:

```bash
POSTGRES_APP_PASSWORD=verification-only SESSION_SECRET=verification-only-session SETUP_TOKEN=verification-only-setup docker compose --env-file /dev/null -p gorms-phase2-verification build app
bash scripts/test-table-plan-runtime.sh
```

This starts only a disposable PG17/CLI verification, not any Compose deployment service.

The integration suite uses a uniquely named internal network, PostgreSQL17 tmpfs,
temporary local upload/backup directories and local test SMTP. No production DB,
NAS, operator .env, real mail or Ollama is used. Browser verification starts only a
temporary verification server on 6143 inside its disposable container and stops it.
Screenshots contain synthetic data in ignored `build/phase2-verification`.
No commit, push or deployment is performed by these checks.

The full dependency audit still has the five documented HIGH braces-tooling-chain
exceptions; it is not clean. See [Security](security.md#dependency-security-correction)
and the [Phase 2 report](phase-2-table-plan-report.md) for actual results and risks.
