# Phase 1 Correction: Dependencies, CAPACITY And SMTP

## Scope And Safety

Date: 2026-10-08. This is the separately approved correction after Multi-Venue Phase 1.
The original [Phase 1 report](phase-1-multi-venue-report.md) remains a historical record.
Existing, uncommitted Multi-Venue changes were retained. No commit, push, deployment, production
database access, NAS access, operator-secret access, Ollama call or real mail delivery is authorized.
Database and SMTP checks use disposable, internal-only PostgreSQL 17/Docker fixtures with synthetic
data. Runtime checks/builds use Node 22. No database migration or data backfill is introduced here.

## Dependency Findings And Exact Updates

The original full audit has 17 PACKAGE entries (1 critical, 13 high, 2 moderate, 1 low), aggregating
51 unique direct advisories plus propagated dependency findings. Package severity is not an
individual reachability verdict. The chains below describe the actual installed app graph;
the relevant path assessment does not claim that an unobserved path proves non-exploitability.

Abbreviations: E = eslint-config-next -> eslint-plugin-react-hooks -> @babel/core.
G = eslint-config-next -> @next/eslint-plugin-next -> fast-glob -> micromatch -> braces.

| Package                  | Severity | Chain                                                                    | Current path relevance                                                                                                        | Before -> after                     |
| ------------------------ | -------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| next                     | critical | direct                                                                   | Public Server Actions expose framework DoS handling before app guards; other advisories depend on platform/routes/config.     | 16.2.9 -> 16.3.8                    |
| nodemailer               | high     | direct                                                                   | SMTP and address parsing are live; bounded guest fields reduce DoS exposure. Raw/JSON/untrusted URL attachments are not used. | 8.0.8 -> 10.0.9                     |
| sharp                    | high     | next -> sharp                                                            | No app Sharp import or permitted SVG/AVIF branding upload; the default image endpoint must still be considered.               | 0.34.5 -> 0.35.5                    |
| postcss                  | high     | next; @tailwindcss/postcss                                               | Malicious CSS/sourceMappingURL; build/repository input, no guest CSS.                                                         | 8.5.15 -> 8.5.23                    |
| nanoid                   | high     | ics; postcss                                                             | Vulnerable size APIs; ICS uses secure nanoid() with its default size, not guest-controlled sizes.                             | 3.3.12 -> 3.3.18                    |
| moment                   | moderate | date-holidays -> date-holidays-parser -> moment-timezone                 | Vulnerable locale inputs; app supplies dates/timezones, not guest locale objects.                                             | 2.30.1 -> 2.31.0                    |
| js-yaml                  | high     | date-holidays; eslint -> @eslint/eslintrc                                | Holiday runtime loads compiled JSON; YAML belongs to library tooling/ESLint, not guest input.                                 | 4.1.1 -> 4.3.2                      |
| source-map-js            | high     | @tailwindcss/postcss -> @tailwindcss/node; postcss                       | Malicious indexed source maps; build input only.                                                                              | 1.2.1 -> 1.2.2                      |
| baseline-browser-mapping | moderate | next; E -> helper-compilation-targets -> browserslist                    | Invalid arguments can terminate a process; no guest-supplied arguments found.                                                 | 2.10.32 -> 2.11.0                   |
| browserslist             | high     | E -> helper-compilation-targets                                          | Malicious queries/custom statistics; trusted repository/build input.                                                          | 4.28.2 -> 4.28.7                    |
| @babel/core              | low      | E                                                                        | Malicious source-map file access; compiler/CI input, not guest processing.                                                    | 7.29.0 -> 7.29.6                    |
| brace-expansion          | high     | eslint -> minimatch; typescript-eslint -> typescript-estree -> minimatch | Glob expansion DoS in tooling; no guest glob expressions. Preserve both major families.                                       | 1.1.14 -> 1.1.21; 5.0.6 -> 5.0.12   |
| braces                   | high     | G                                                                        | Recursive glob AST stack exhaustion; tooling input. No published fixed version.                                               | 3.0.3 unchanged, exception          |
| micromatch               | high     | G                                                                        | Propagated braces advisory.                                                                                                   | 4.0.8 unchanged, exception          |
| fast-glob                | high     | G                                                                        | Propagated braces advisory; 3.3.3 still uses affected micromatch/braces.                                                      | 3.3.1 unchanged, exception          |
| @next/eslint-plugin-next | high     | G                                                                        | Propagated braces advisory. Framework alignment does not fix braces.                                                          | 16.2.9 -> 16.3.8, exception remains |
| eslint-config-next       | high     | G                                                                        | Propagated braces advisory. Do not downgrade this config to Next 14.                                                          | 16.2.9 -> 16.3.8, exception remains |

Direct versions and compatible security overrides are pinned. brace-expansion overrides select
major 1 and major 5 separately. React/React DOM 19.2.7, PostgreSQL, Drizzle and business rules stay
unchanged. The existing esbuild override is retained. npm ci regenerates installed artifacts from
the lockfile; no audit fix --force, bulk major update, local dependency fork/patch or codemod is used.

Critical Next advisories include Windows RCE (the Docker runtime is Linux), AVIF image-optimizer
RCE (no known permitted AVIF input path), and next/og RCE (no ImageResponse/OG route). These path
differences reduce specific exposure, not the need to update Next. Server Actions DoS remains
relevant. Custom rewrites, Edge custom-server behavior, locale proxy rules and use-cache-specific
paths are not configured. Next/ESLint remain aligned at the smallest checked fixed 16.x release.
The local installed Next upgrade guides were read in accordance with AGENTS.md.

### Necessary Plan Deviation: Nodemailer 10.0.9

The plan proposed 10.0.6 to close the advisories affecting 8.0.8. Checking that exact upgraded
graph exposed an additional MODERATE finding not affecting version 8:
[GHSA-g57g-f23g-4646](https://github.com/nodemailer/nodemailer/security/advisories/GHSA-g57g-f23g-4646)
affects >=9.1.0 and <10.0.9 (quoted local-part/comment parsing into malformed envelope recipients).
The 10.0.6 graph therefore reported 6 findings: 1 moderate plus the 5 agreed tooling entries.
Version 10.0.9 is the first patch fixing the newly introduced finding; a targeted 10.0.6 -> 10.0.9
adjustment, not a further major upgrade, is necessary to avoid introducing a runtime vulnerability.

Nodemailer 10 supplies its own declarations. @types/nodemailer is removed; email.ts imports
SMTPSentMessageInfo and Transporter from the public package rather than the old deep type import.
createTransport(), SMTP auth, sendMail(), address objects, replyTo and calendar attachments remain
compatible. No message template, send order or SMTP configuration policy is changed.

### Remaining Tooling Exception

The five remaining high PACKAGE findings share
[GHSA-vfj7-8cjw-p6xm / CVE-2026-93687](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm).
As of this report, braces 3.0.3 has no published fix; upstream
[issue 70](https://github.com/micromatch/braces/issues/70) is open. Guest data does not feed these
glob patterns, but untrusted repository/configuration input could affect development or CI.
The production image currently contains devDependencies, including this chain. An omit-dev audit
does not mean those files have been removed from the image.

The exception is restricted to these exact five packages, the advisory and tooling path, NOT a
blanket high-severity exemption. Recheck upstream availability at every dependency update and
before a release; any changed/new advisory requires review. No fork, patch, config downgrade or
audit suppression was added. The overall full audit is explicitly NOT free of findings.

Sources for version boundaries: [Next 16.3.8](https://github.com/vercel/next.js/releases/tag/v16.3.8),
[Nodemailer 10.0.6](https://github.com/nodemailer/nodemailer/releases/tag/v10.0.6),
[sharp](https://github.com/advisories/GHSA-wq5f-xc86-pv6w),
[postcss](https://github.com/advisories/GHSA-fxqj-rqcc-2cmp),
[nanoid](https://github.com/advisories/GHSA-2v37-7h3g-55p8),
[moment](https://github.com/advisories/GHSA-4p3w-j4w9-5jqw),
[js-yaml](https://github.com/advisories/GHSA-2883-xcg3-v3hh),
[source-map-js](https://github.com/advisories/GHSA-68fv-2mgg-jv7q),
[baseline-browser-mapping](https://github.com/advisories/GHSA-w5vr-8v7q-w6rv),
[browserslist](https://github.com/advisories/GHSA-c83g-rgw3-j3cx),
[Babel](https://github.com/advisories/GHSA-4x5r-pxfx-6jf8),
[brace-expansion](https://github.com/advisories/GHSA-q2hr-2g5m-vwhr).

## CAPACITY: Red Before Green

PostgreSQL TIME WITHOUT TIME ZONE is returned as a string such as 14:00:00. timeToMinutes()
previously delegated validation to the HH:MM-only isTime() and returned null. getGuestsInWindow()
then skipped each such row. Venue/date/status filters were correct; the subsequent totals were not.

The regression was executed BEFORE modifying the parser under Node 22.22.3:

- Real PostgreSQL 17 integration: stored value was asserted to be 14:00:00; acceptedGuestsInWindow
  failed with actual 0, expected 11.
- Pure parser regression: timeToMinutes('14:00:00') failed with actual null, expected 840.

The correction only changes the numeric conversion: validated HH:MM or HH:MM:SS with an optional
1-6 digit seconds fraction converts to hours\*60 + minutes + seconds/60. No Date object, timezone
conversion, rounding or blind string truncation is used. Full-string matching rejects malformed
suffixes/newlines. Invalid hours/minutes/seconds still return null. isTime() and public/settings
validation remain HH:MM. No DB parser override is installed globally or in the integration tests.

Tests now use the actual pg TIME parser. Cases cover zero/nonzero/microseconds, touching windows,
one-second and microsecond overlaps, accepted/pending vs declined/cancelled, different dates and
venues, at-capacity vs over-capacity totals, and the unchanged nonblocking capacity-warning rule.
Existing 14 CAPACITY golden cases, TABLES rejection, holiday/day/event rules, duration and time
limits remain unchanged. New snapshots/mail counts can display warnings previously missed by the
bug. Historical snapshots are not recalculated; no stored request time or status is rewritten.

## SMTP Compatibility Coverage

Tests use local, non-relaying SMTP sinks in the same isolated container:

- SMTP createTransport/sendMail with user/pass auth; AUTH PLAIN and LOGIN, correct and incorrect
  credentials. Two venues have different users/passwords/from names/addresses; a broken HK secret
  does not affect the other venue and foreign request IDs cannot trigger SMTP.
- Implicit TLS on actual port 465; advertised STARTTLS on actual port 587. Host OpenSSL generates
  ephemeral one-day certificates with localhost/127.0.0.1 SANs. Only the trusted test CA is added
  at Node startup through NODE_EXTRA_CA_CERTS. Untrusted certificates fail before AUTH and leave
  pending reservations unchanged. No rejectUnauthorized=false or NODE_TLS_REJECT_UNAUTHORIZED=0.
- SMTP envelope sender/recipient plus MIME from, to, replyTo and subject. UTF-8 German umlauts
  survive header, plain-body, HTML and calendar encoding. The scoped test MIME decoder uses the
  package's structured content-type parser and handles only app-generated test MIME formats.
- Internal request ICS (TENTATIVE), internal confirmation ICS (CONFIRMED), expected UID, filename,
  decoded calendar content and Berlin 14:00 -> 12:00Z. Guest receipts have no calendar attachment.
- AUTH refusal, RCPT refusal, DATA refusal and connection interruption: no accepted message,
  failed mail history entry and unchanged pending status. On success, the sink observes pending
  at guest-mail acknowledgement and accepted at the subsequent internal confirmation mail.

Existing SMTP policy is preserved: non-465 STARTTLS is opportunistic, not mandatory. The tests
prove upgrade/certificate verification when offered, not a new enforced requireTLS policy.
IONOS production credentials/provider delivery are deliberately not contacted or certified.

## Checks

All final functional/code/build checks succeeded. Runtime checks used Node 22.22.3 for the test
runner and Node 22.23.3 in the newly built image; the Playwright image also passed the explicit
Node-major-22 guard. All database tests used isolated PostgreSQL 17, no published database/SMTP
ports and no deployment volumes/.env.

| Check                                                                                                                        | Outcome                                                                                                                                                                                |
| ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CAPACITY DB regression BEFORE fix                                                                                            | Expected RED: actual 0 vs expected 11, with stored 14:00:00.                                                                                                                           |
| Pure time parser BEFORE fix                                                                                                  | Expected RED: null vs 840 for 14:00:00.                                                                                                                                                |
| Node 22 npm ci                                                                                                               | Successful repeatable install of the updated lockfile. Existing esbuild-kit deprecation notices remain, not new security findings.                                                     |
| npm ls (all targeted packages)                                                                                               | Successful: exact pins/compatible overrides and both brace-expansion families verified.                                                                                                |
| npm run test:venue-foundation                                                                                                | PASS: time formats/contracts plus hosts, retention, four timezones, NRW holidays, DST and ICS.                                                                                         |
| npm run test:multi-venue                                                                                                     | PASS: upgrade/new install, exact backfill/ciphertext, host import rollback/retry/idempotence, six retention cases, two venues, CAPACITY, local SMTP and cleanup.                       |
| MULTI_VENUE_WEB_TEST=true MULTI_VENUE_TEST_IMAGE=mcr.microsoft.com/playwright:v1.56.1-noble bash scripts/test-multi-venue.sh | PASS: entire integration plus real Next 16.3.8 build, Host/Origin/forwarded routing, foreign IDs/ICS, branding, stale forms and 1440/390-pixel Playwright screenshots/overflow checks. |
| npm run test:ai-validation                                                                                                   | PASS. No Ollama calls.                                                                                                                                                                 |
| npm run test:special-requests                                                                                                | PASS.                                                                                                                                                                                  |
| npm run lint                                                                                                                 | PASS.                                                                                                                                                                                  |
| npm run typecheck                                                                                                            | PASS.                                                                                                                                                                                  |
| npm run format:check                                                                                                         | PASS.                                                                                                                                                                                  |
| npm run build                                                                                                                | PASS in isolated web verification and Docker builder.                                                                                                                                  |
| docker compose --env-file /dev/null -p gorms-correction-verification build app                                               | PASS, using dummy build-only required ENV variables, not the operator .env. Dedicated verification image, no Compose service start/recreate.                                           |
| Built-image Node/module/native test                                                                                          | PASS: Node 22.23.3, Next 16.3.8, Nodemailer 10.0.9, Sharp 0.35.5 and actual PNG encode/decode.                                                                                         |
| Built-image runtime scripts                                                                                                  | PASS: migrate twice, idempotent legacy host import, host CLI, cleanup with DB retention 30 despite ENV 90, all against a separate disposable database.                                 |
| bash -n scripts/test-multi-venue.sh                                                                                          | PASS.                                                                                                                                                                                  |
| git diff --check                                                                                                             | PASS.                                                                                                                                                                                  |
| npm audit --json                                                                                                             | Exit 1, EXPECTED: exactly the five HIGH tooling exceptions, zero critical/moderate/low. Overall audit is NOT clean.                                                                    |
| npm audit --omit=dev --json                                                                                                  | Exit 0: zero findings in the runtime dependency graph, NOT certification of the full image.                                                                                            |

The first native-image probe tried reading sharp/package.json, which Sharp 0.35.5 does not export.
The test probe was corrected to its public sharp.versions.sharp API, then passed with actual image
encoding/decoding. No application workaround or weakening of package exports was made.
Screenshots in ignored build/phase1-verification contain only synthetic data; public/mobile and
admin/desktop views were also visually inspected. Temporary databases/networks/certificates were
removed by the test launchers. The built verification image is only a build artifact, not deployed.
Production preflight/live-workflow commands and real IONOS delivery were deliberately NOT run.

## Files In This Correction

- package.json and package-lock.json: exact direct/transitive security updates and native types.
- src/lib/dates.ts: the small database-time numeric parser correction only.
- src/server/email.ts: public Nodemailer type imports only; existing Multi-Venue code retained.
- scripts/check-venue-foundation.ts: parser/input-contract/timezone regression cases.
- scripts/check-multi-venue.ts: remove test-only pg parser; add time/boundary and SMTP assertions.
- scripts/smtp-test-fixture.ts: isolated protocol/MIME verification helper, no relay or persistence.
- scripts/test-multi-venue.sh: ephemeral trusted/untrusted certificates and test-only CA mount.
- docs/security.md and docs/multi-venue.md: current behavior, exceptions and test prerequisites.
- docs/phase-1-correction-report.md: this report. The original Phase 1 report is unchanged.

## Remaining Risks

- Five unpatched high tooling findings remain; full audit is not clean. Production image still
  includes tooling dependencies. Registry/advisory state can change after this dated check.
- Next minor upgrade and native Sharp dependencies need continued platform-specific verification;
  tests target the current Linux/Node 22 build, not every deployment architecture.
- Nodemailer major API/types/configuration were checked locally. No real-provider delivery test or
  strict mandatory-STARTTLS policy was introduced. No claim about production IONOS connectivity.
- Correct counts can add legitimate warnings; historical incorrect snapshots remain historical.
- The original Phase 1 boundaries (global roles, concurrent mail decisions, future-venue policy,
  snapshot retention, proxy trust and target-server restore/DDL assessment) are not changed.
