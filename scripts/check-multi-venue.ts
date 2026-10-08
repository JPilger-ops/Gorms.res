import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { request as httpRequest } from "node:http";
import { cp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { pool } from "@/src/server/db";
import { HEIDEKOENIG_VENUE_ID as hkId, LEGACY_HOST_IMPORT_KEY } from "@/src/lib/venue-defaults.mjs";
import { configureVenueHosts, importLegacyPublicHosts } from "@/scripts/venue-hosts-lib.mjs";
import { cleanupRetention } from "@/scripts/retention-lib.mjs";
import {
  getAdminSettings,
  getBusinessSettings,
  getSmtpSettings,
  getSmtpSettingsForUi,
  updateOpeningHours,
  updateSmtpSettings,
} from "@/src/server/settings";
import { decryptSecret, encryptSecret } from "@/src/server/encryption";
import {
  getVenueById,
  getOperationalVenues,
  resolvePublicVenue,
  type VenueContext,
} from "@/src/server/venues";
import {
  checkReservationAvailability,
  getAvailabilityCheckForReservation,
  saveAvailabilityCheckSnapshot,
} from "@/src/server/reservation-availability";
import { createBlockedDay, deleteBlockedDay, getBlockedDays } from "@/src/server/blocked-days";
import {
  createReservationEvent,
  deleteReservationEvent,
  listReservationEvents,
} from "@/src/server/reservation-events";
import {
  createReservationRequest,
  getAdminReservationRequests,
  updateReservationStatus,
} from "@/src/server/reservations";
import { getAdminReservationDetail } from "@/src/server/reservation-detail";
import { getReservationIcsDownload } from "@/src/server/reservation-ics";
import { getAdminDashboardData } from "@/src/server/dashboard";
import {
  listOutgoingEmailsForReservation,
  recordReservationOutgoingEmail,
} from "@/src/server/reservation-outgoing-emails";
import { generateReservationDecisionAiDraft } from "@/src/server/ai/reservation-drafts";
import { sendReservationDecision } from "@/src/server/reservation-decisions";
import {
  buildGuestReservationReceiptEmailContent,
  buildInternalReservationEmailContent,
  sendGuestReservationReceiptEmail,
  sendInternalReservationEmail,
  sendGuestReservationDecisionEmail,
  sendSmtpTestEmail,
} from "@/src/server/email";
import { createSmtpFixture, parseFixtureMessage } from "@/scripts/smtp-test-fixture";
import {
  getBrandingSettings,
  getBrandingAsset,
  updateBrandingSettings,
  updateBrandingAsset,
} from "@/src/server/branding";
import { runRetentionCleanup } from "@/src/server/retention";
import { createSession } from "@/src/server/sessions";
import type { AuthenticatedSession } from "@/src/server/guards";

const url = new URL(process.env.DATABASE_URL ?? "http://invalid");
assert.equal(process.env.MULTI_VENUE_ISOLATED_TEST, "true");
assert.equal(url.hostname, "phase1-db");
assert.equal(url.pathname, "/gorms_phase1_test");
assert.equal(Number(process.versions.node.split(".")[0]), 22);

const otherId = "00000000-0000-4000-8000-000000000004";
const tablesId = "00000000-0000-4000-8000-000000000003";
const userId = randomUUID();
const session: AuthenticatedSession = {
  userId,
  name: "Fixture Admin",
  email: "admin@example.invalid",
  role: "admin",
  isActive: true,
  sessionId: randomUUID(),
  expiresAt: new Date("2099-01-01Z"),
};
const publicHosts = (process.env.PUBLIC_ALLOWED_HOSTS ?? "").split(",");
const adminHosts = ["login.gorms.de", "localhost"];

async function resetDatabase() {
  // This destructive helper is reachable only after the isolated database guard above.
  await pool.query(
    "drop schema if exists drizzle cascade; drop schema public cascade; create schema public",
  );
}

function runMigration(publicAllowed = process.env.PUBLIC_ALLOWED_HOSTS) {
  execFileSync(process.execPath, ["scripts/migrate.mjs"], {
    env: { ...process.env, PUBLIC_ALLOWED_HOSTS: publicAllowed },
    stdio: "pipe",
  });
}

async function migrateLegacy(limit = 3) {
  const directory = await mkdtemp(join(tmpdir(), "gorms-v11-"));
  try {
    const journal = JSON.parse(await readFile("db/migrations/meta/_journal.json", "utf8"));
    journal.entries = journal.entries.slice(0, limit);
    await mkdir(join(directory, "meta"));
    await writeFile(join(directory, "meta/_journal.json"), JSON.stringify(journal));
    for (const entry of journal.entries)
      await copyFile(`db/migrations/${entry.tag}.sql`, join(directory, `${entry.tag}.sql`));
    await migrate(drizzle(pool), { migrationsFolder: directory });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

async function setting(venueId: string, key: string, value: string) {
  await pool.query(
    "insert into venue_settings (venue_id, key, value) values ($1,$2,$3) on conflict (venue_id,key) do update set value=excluded.value",
    [venueId, key, value],
  );
}

async function createOtherVenues() {
  await pool.query(
    "insert into venues (id,slug,name,short_name,time_zone,availability_strategy,is_active) values ($1,'fixture-capacity','Fixture Capacity','Fixture','Europe/Berlin','CAPACITY',true),($2,'fixture-tables','Fixture Tables','Tables','Europe/Berlin','TABLES',true)",
    [otherId, tablesId],
  );
}

async function upgradeChecks() {
  await resetDatabase();
  await migrateLegacy();
  await pool.query(
    "insert into users (id,email,name,password_hash,role) values ($1,'admin@example.invalid','Fixture Admin','not-a-real-password','admin')",
    [userId],
  );
  const cipher = encryptSecret("fixture-smtp-secret");
  for (const [key, value, secret] of [
    ["reservation_retention_days", "30", false],
    ["smtp_password", cipher, true],
    ["branding_logo_file", "logo-existing.png", false],
    ["setup_completed", "true", false],
    ["audit_log_retention_days", "90", false],
  ]) {
    await pool.query(
      "insert into app_settings (key,value,is_secret,updated_by_user_id,updated_at) values ($1,$2,$3,$4,'2026-06-01T12:34:56Z')",
      [key, value, secret, userId],
    );
  }
  const requestId = randomUUID();
  await pool.query(
    "insert into reservation_requests (id,requested_date,requested_time,guest_name,guest_email,guest_phone,guest_count,message,status,privacy_acknowledged_at,created_at,updated_at) values ($1,'2026-06-19','14:00','Existing Guest','guest@example.invalid','012345678',8,'Existing message','accepted','2026-06-01T10:00Z','2026-06-01T10:00Z','2026-06-02T11:00Z')",
    [requestId],
  );
  await pool.query(
    "insert into blocked_days (date,reason,created_at) values ('2026-06-20','Existing block','2026-06-01T10:00Z')",
  );
  await pool.query(
    "insert into reservation_events (date,title,public_note,created_by_user_id,created_at,updated_at) values ('2026-06-21','Existing event','Existing note',$1,'2026-06-01T10:00Z','2026-06-02T11:00Z')",
    [userId],
  );
  await pool.query(
    "insert into reservation_availability_checks (reservation_request_id,status,requested_guest_count,capacity,window_start,window_end,latest_reservation_time,season) values ($1,'manual_review',8,70,'14:00','16:00','18:00','summer')",
    [requestId],
  );
  await pool.query(
    "insert into reservation_outgoing_emails (reservation_request_id,type,recipient,subject,body,smtp_status) values ($1,'guest_acceptance','guest@example.invalid','Original subject','Original body','sent')",
    [requestId],
  );
  await pool.query(
    "insert into audit_log (action,entity_type,entity_id,metadata) values ('reservation.created','reservation_request',$1,'{\"unchanged\":true}'),('login.success','security',null,'{\"unchanged\":true}')",
    [requestId],
  );
  const tables = [
    "reservation_requests",
    "blocked_days",
    "reservation_events",
    "reservation_availability_checks",
    "reservation_outgoing_emails",
    "users",
    "audit_log",
  ];
  const before = new Map<string, unknown[]>();
  for (const table of tables)
    before.set(
      table,
      (await pool.query(`select to_jsonb(t) as data from ${table} t order by id`)).rows.map(
        (r) => r.data,
      ),
    );
  const settingsBefore = (
    await pool.query("select to_jsonb(t) as data from app_settings t order by key")
  ).rows.map((r) => r.data);
  runMigration();
  for (const table of tables) {
    const after = (
      await pool.query(`select to_jsonb(t) - 'venue_id' as data from ${table} t order by id`)
    ).rows.map((r) => r.data);
    assert.deepEqual(after, before.get(table), `Existing ${table} rows must survive unchanged`);
  }
  for (const old of settingsBefore) {
    const source = ["setup_completed", "audit_log_retention_days"].includes(old.key)
      ? "app_settings"
      : "venue_settings";
    const row = (
      await pool.query(`select to_jsonb(t) - 'venue_id' as data from ${source} t where key=$1`, [
        old.key,
      ])
    ).rows[0].data;
    assert.deepEqual(row, old);
  }
  assert.equal(
    decryptSecret(
      (await pool.query("select value from venue_settings where key='smtp_password'")).rows[0]
        .value,
    ),
    "fixture-smtp-secret",
  );
  assert.equal(
    (await pool.query("select count(*)::int as count from app_settings where key='smtp_password'"))
      .rows[0].count,
    0,
  );
  assert.equal((await getAdminSettings((await getVenueById(hkId))!)).reservationRetentionDays, 30);
  assert.equal(
    (
      await pool.query(
        "select count(*)::int as count from reservation_requests where venue_id=$1",
        [hkId],
      )
    ).rows[0].count,
    1,
  );
  assert.equal(
    (await pool.query("select venue_id from audit_log where entity_type='security'")).rows[0]
      .venue_id,
    null,
  );
  const eventColumns = (
    await pool.query(
      "select column_name from information_schema.columns where table_name='reservation_events'",
    )
  ).rows.map((r) => r.column_name);
  assert.equal(eventColumns.includes("reservation_request_id"), false);
  for (const host of [
    "heidekönig.gorms.de",
    "xn--heideknig-57a.gorms.de",
    "alias.hk.test",
    "127.0.0.1",
  ]) {
    assert.equal((await resolvePublicVenue({ host, publicHosts, adminHosts }))?.id, hkId);
  }
  const originalHosts = (await pool.query("select * from venue_hosts order by host")).rows;
  runMigration("login.gorms.de"); // A completed import cannot overwrite mappings, even with changed ENV.
  assert.deepEqual(
    (await pool.query("select * from venue_hosts order by host")).rows,
    originalHosts,
  );
  console.log(
    "PASS: V1.1 upgrade, exact backfill/ciphertext preservation and ENV host import/idempotence.",
  );

  await resetDatabase();
  await migrateLegacy();
  assert.throws(() => runMigration("alias.hk.test,login.gorms.de"));
  assert.equal(
    (
      await pool.query("select count(*)::int as count from app_settings where key=$1", [
        LEGACY_HOST_IMPORT_KEY,
      ])
    ).rows[0].count,
    0,
  );
  assert.equal(
    (await pool.query("select count(*)::int as count from venue_hosts")).rows[0].count,
    0,
  );
  runMigration();
  await createOtherVenues();
  await pool.query("delete from app_settings where key=$1", [LEGACY_HOST_IMPORT_KEY]);
  await configureVenueHosts(pool, {
    slug: "fixture-capacity",
    hosts: "conflict.test",
    publicHosts: "conflict.test",
    adminHosts: adminHosts.join(","),
  });
  await assert.rejects(
    importLegacyPublicHosts(pool, { publicHosts: "new-alias.test,conflict.test" }),
  );
  assert.equal(
    (await pool.query("select count(*)::int as count from venue_hosts where host='new-alias.test'"))
      .rows[0].count,
    0,
  );
  assert.equal(
    (
      await pool.query("select count(*)::int as count from app_settings where key=$1", [
        LEGACY_HOST_IMPORT_KEY,
      ])
    ).rows[0].count,
    0,
  );
  await importLegacyPublicHosts(pool, { publicHosts: process.env.PUBLIC_ALLOWED_HOSTS });
  assert.equal(
    (await pool.query("select venue_id from venue_hosts where host='conflict.test'")).rows[0]
      .venue_id,
    otherId,
  );
  console.log("PASS: failed host imports roll back atomically and remain safely retryable.");
  await resetDatabase();
  runMigration();
  assert.equal((await pool.query("select count(*)::int as count from venues")).rows[0].count, 2);
  assert.equal(
    (await pool.query("select count(*)::int as count from reservation_requests")).rows[0].count,
    0,
  );
  console.log(
    "PASS: clean installation creates Heidekönig and Telegraph without requests or Telegraph public hosts.",
  );
}

async function retentionUpgradeChecks() {
  const cases: [string | undefined, string | undefined, number][] = [
    ["30", "90", 30],
    ["42", "90", 42],
    [undefined, "45", 45],
    ["invalid", "45", 45],
    [undefined, undefined, 30],
    ["0", "45", 45],
  ];
  for (const [databaseValue, environmentValue, expected] of cases) {
    await resetDatabase();
    await migrateLegacy();
    if (databaseValue !== undefined)
      await pool.query(
        "insert into app_settings (key,value) values ('reservation_retention_days',$1)",
        [databaseValue],
      );
    runMigration();
    const result = await cleanupRetention(pool, {
      reservationFallback: environmentValue ?? "",
      now: new Date("2026-06-19T12:00Z"),
    });
    assert.equal(result.venueResults[0].reservationRetentionDays, expected);
    const runtime = execFileSync(process.execPath, ["scripts/cleanup-reservations.mjs"], {
      env: { ...process.env, RESERVATION_RETENTION_DAYS: environmentValue ?? "" },
      encoding: "utf8",
    });
    assert.match(runtime, new RegExp(`${hkId}: ${expected} days;`));
    const server = execFileSync(
      "node_modules/.bin/tsx",
      [
        "-e",
        `import {getAdminSettings} from './src/server/settings'; import {getVenueById} from './src/server/venues'; import {runRetentionCleanup} from './src/server/retention'; import {pool} from './src/server/db'; (async()=>{const v=await getVenueById('${hkId}'); const a=await getAdminSettings(v!); const b=await runRetentionCleanup(); console.log(JSON.stringify([a.reservationRetentionDays,b.venueResults[0].reservationRetentionDays])); await pool.end();})()`,
      ],
      {
        env: { ...process.env, RESERVATION_RETENTION_DAYS: environmentValue ?? "30" },
        encoding: "utf8",
      },
    );
    assert.deepEqual(JSON.parse(server.trim()), [expected, expected]);
  }
  console.log("PASS: six retention upgrade variants; settings, server and runtime CLI agree.");
}

async function insertReservation(
  venue: VenueContext,
  options: {
    status?: string;
    daysOld?: number;
    date?: string;
    guestCount?: number;
    time?: string;
  } = {},
) {
  const id = randomUUID();
  const createdAt = new Date(Date.now() - (options.daysOld ?? 0) * 86400000);
  await pool.query(
    "insert into reservation_requests (id,venue_id,requested_date,requested_time,guest_name,guest_email,guest_phone,guest_count,message,status,privacy_acknowledged_at,created_at) values ($1,$2,$3,$7,'Fixture Guest','guest@example.invalid','012345678',$4,'Test request',$5,now(),$6)",
    [
      id,
      venue.id,
      options.date ?? "2099-06-19",
      options.guestCount ?? 8,
      options.status ?? "pending",
      createdAt,
      options.time ?? "14:00",
    ],
  );
  return id;
}

async function isolationChecks() {
  await resetDatabase();
  runMigration();
  await createOtherVenues();
  await pool.query(
    "insert into users (id,email,name,password_hash,role) values ($1,'admin@example.invalid','Fixture Admin','not-a-real-password','admin')",
    [userId],
  );
  const hk = (await getVenueById(hkId))!;
  const other = (await getVenueById(otherId))!;
  const tables = (await getVenueById(tablesId))!;
  assert.equal((await getOperationalVenues()).length, 2);
  await setting(hk.id, "reservation_retention_days", "30");
  await setting(hk.id, "max_guests_per_request", "70");
  await setting(hk.id, "indoor_capacity", "70");
  await setting(other.id, "indoor_capacity", "12");
  await setting(other.id, "block_mondays", "false");
  assert.equal((await getBusinessSettings(hk)).indoorCapacity, 70);
  assert.equal((await getBusinessSettings(other)).indoorCapacity, 12);
  assert.equal((await getBusinessSettings(hk)).blockMondays, true);
  assert.equal((await getBusinessSettings(other)).blockMondays, false);
  assert.equal((await getSmtpSettings(hk)).passwordSource, "environment");
  assert.equal((await getSmtpSettings(other)).passwordSource, "missing");
  assert.equal((await getSmtpSettings(other)).user, undefined);
  await updateOpeningHours(
    other,
    { earliestReservationTime: "12:00", latestReservationTime: "18:00" },
    session,
  );
  assert.equal((await getBusinessSettings(hk)).earliestReservationTime, "11:30");
  assert.equal((await getBusinessSettings(other)).earliestReservationTime, "12:00");
  const date = "2099-06-19";
  const blocked = await createBlockedDay(hk, { date, reason: "HK only" }, session);
  assert.equal(
    (await checkReservationAvailability(hk, { date, time: "14:00", guestCount: 2 })).hardBlocked,
    true,
  );
  assert.equal(
    (await checkReservationAvailability(other, { date, time: "14:00", guestCount: 2 })).hardBlocked,
    false,
  );
  await createBlockedDay(other, { date, reason: "Other only" }, session);
  assert.equal((await getBlockedDays(hk)).length, 1);
  assert.equal((await getBlockedDays(other))[0].reason, "Other only");
  assert.equal(await deleteBlockedDay(other, blocked.id, session), false);
  await deleteBlockedDay(hk, blocked.id, session);
  await pool.query("delete from blocked_days where venue_id=$1", [other.id]);
  const event = await createReservationEvent(
    hk,
    { date, title: "HK music", publicNote: "HK event only", reservationsAllowed: false },
    session,
  );
  assert.equal(
    (await checkReservationAvailability(hk, { date, time: "14:00", guestCount: 2 })).hardBlocked,
    true,
  );
  assert.equal(
    (await checkReservationAvailability(other, { date, time: "14:00", guestCount: 2 })).hardBlocked,
    false,
  );
  assert.equal((await listReservationEvents(other)).length, 0);
  assert.equal(await deleteReservationEvent(other, event.id, session), false);
  await deleteReservationEvent(hk, event.id, session);
  const id = await insertReservation(hk);
  const otherRequestId = await insertReservation(other);
  assert.equal((await getAdminReservationRequests(hk, { status: "all" })).total, 1);
  assert.equal((await getAdminReservationRequests(other, { status: "all" })).total, 1);
  assert.equal((await getAdminDashboardData(hk)).recentReservations[0].id, id);
  assert.equal((await getAdminDashboardData(other)).recentReservations[0].id, otherRequestId);
  assert.equal(await getAdminReservationDetail(other, id), null);
  assert.equal(await getReservationIcsDownload(other, id, "request"), null);
  assert.equal(
    (await updateReservationStatus(other, { id, status: "declined", reason: "test" }, session)).ok,
    false,
  );
  assert.equal(
    (
      await sendReservationDecision(
        other,
        { id, decision: "accept", expectedStatus: "pending", body: "Test", subject: "Test" },
        session,
      )
    ).ok,
    false,
  );
  assert.equal(
    (await generateReservationDecisionAiDraft({ venue: other, id, decision: "accept", session }))
      .ok,
    false,
  );
  const snapshot = await checkReservationAvailability(hk, { date, time: "14:00", guestCount: 8 });
  await saveAvailabilityCheckSnapshot(hk, { ...snapshot, reservationRequestId: id });
  await assert.rejects(
    saveAvailabilityCheckSnapshot(other, { ...snapshot, reservationRequestId: id }),
  );
  await assert.rejects(getAvailabilityCheckForReservation(other, id));
  await recordReservationOutgoingEmail(hk, {
    reservationRequestId: id,
    body: "Fixture body",
    recipient: "guest@example.invalid",
    subject: "Fixture",
    smtpStatus: "sent",
    type: "guest_question",
  });
  await assert.rejects(
    recordReservationOutgoingEmail(other, {
      reservationRequestId: id,
      body: "Wrong venue",
      recipient: "guest@example.invalid",
      subject: "Fixture",
      smtpStatus: "sent",
      type: "guest_question",
    }),
  );
  await assert.rejects(listOutgoingEmailsForReservation(other, id));
  assert.equal((await listOutgoingEmailsForReservation(hk, id)).length, 1);
  await assert.rejects(
    checkReservationAvailability(tables, { date, time: "14:00", guestCount: 2 }),
  );
  await assert.rejects(
    createReservationRequest(tables, {
      date,
      time: "14:00",
      guestCount: 2,
      guestName: "Test",
      email: "guest@example.invalid",
      phone: "012345678",
      privacyAccepted: "true",
      website: undefined,
    }),
  );
  await configureVenueHosts(pool, {
    slug: other.slug,
    hosts: "other.test",
    publicHosts: "other.test",
    adminHosts: adminHosts.join(","),
  });
  await assert.rejects(
    configureVenueHosts(pool, {
      slug: other.slug,
      hosts: "login.gorms.de",
      publicHosts: "login.gorms.de",
    }),
  );
  await assert.rejects(
    configureVenueHosts(pool, {
      slug: other.slug,
      hosts: "alias.hk.test",
      publicHosts: "alias.hk.test",
    }),
  );
  const allowed = [...publicHosts, "other.test", "unassigned.test"];
  assert.equal(
    (await resolvePublicVenue({ host: "other.test", publicHosts: allowed, adminHosts }))?.id,
    other.id,
  );
  assert.equal(
    (
      await resolvePublicVenue({
        host: "heidekönig.gorms.de",
        origin: "https://xn--heideknig-57a.gorms.de",
        publicHosts: allowed,
        adminHosts,
      })
    )?.id,
    hk.id,
  );
  for (const host of ["unassigned.test", "unknown.test", "login.gorms.de"])
    assert.equal(await resolvePublicVenue({ host, publicHosts: allowed, adminHosts }), null);
  assert.equal(
    await resolvePublicVenue({
      host: "alias.hk.test",
      origin: "https://other.test",
      publicHosts: allowed,
      adminHosts,
    }),
    null,
  );
  assert.equal(
    await resolvePublicVenue({
      host: "alias.hk.test",
      origin: "https://login.gorms.de",
      publicHosts: allowed,
      adminHosts,
    }),
    null,
  );
  assert.equal(
    await resolvePublicVenue({
      host: "alias.hk.test",
      origin: "invalid",
      publicHosts: allowed,
      adminHosts,
    }),
    null,
  );
  await pool.query("update venues set is_active=false where id=$1", [other.id]);
  assert.equal(
    await resolvePublicVenue({ host: "other.test", publicHosts: allowed, adminHosts }),
    null,
  );
  await pool.query("update venues set is_active=true where id=$1", [other.id]);
  await updateBrandingSettings(other, { accentColor: "#123456" }, session);
  assert.equal((await getBrandingSettings(other)).accentColor, "#123456");
  assert.equal((await getBrandingSettings(hk)).accentColor, "#234235");
  const uploaded = await updateBrandingAsset({
    venue: hk,
    kind: "logo",
    session,
    file: new File(
      [
        Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jqvoAAAAASUVORK5CYII=",
          "base64",
        ),
      ],
      "test.png",
    ),
  });
  assert.equal(uploaded.ok, true);
  assert.ok(await getBrandingAsset(hk, "logo"));
  assert.equal(await getBrandingAsset(other, "logo"), null);
  await assert.rejects(pool.query("insert into blocked_days (date) values ('2099-06-20')"));
  await assert.rejects(
    pool.query("insert into venue_hosts (host,venue_id) values ('missing.test',$1)", [
      randomUUID(),
    ]),
  );
  console.log(
    "PASS: two-venue isolation across settings, branding, days, events, lists, details, changes, snapshots, mail, AI, hosts and TABLES rejection.",
  );
  return { hk, other, id, otherRequestId };
}

async function capacityChecks(hk: VenueContext, other: VenueContext) {
  const now = new Date("2026-06-01T12:00Z");
  const cases: [string, string, number, string][] = [
    ["2026-06-19", "14:00", 8, "bookable"],
    ["2026-06-19", "14:00", 30, "manual_review"],
    ["2026-06-19", "14:00", 71, "blocked"],
    ["2026-06-19", "10:00", 8, "blocked"],
    ["2026-06-19", "18:01", 8, "blocked"],
    ["2026-06-15", "14:00", 8, "blocked"],
    ["2026-06-16", "14:00", 8, "blocked"],
    ["2026-06-14", "14:00", 8, "blocked"],
    ["2026-06-04", "14:00", 8, "blocked"],
    ["2026-05-29", "14:00", 8, "blocked"],
    ["2026-11-06", "17:01", 8, "blocked"],
    ["2026-11-06", "17:00", 8, "bookable"],
    ["2026-02-30", "14:00", 8, "blocked"],
    ["2026-06-19", "bad", 8, "blocked"],
  ];
  for (const [date, time, guestCount, expected] of cases) {
    const result = await checkReservationAvailability(hk, { date, time, guestCount }, now);
    assert.equal(result.status, expected, `${date}/${time}/${guestCount}`);
    assert.equal(result.capacity, 70);
  }
  const otherResult = await checkReservationAvailability(
    other,
    { date: "2026-06-19", time: "14:00", guestCount: 13 },
    now,
  );
  assert.equal(otherResult.status, "capacity_warning");
  assert.equal(otherResult.hardBlocked, false);
  const acceptedId = await insertReservation(other, { guestCount: 11, status: "accepted" });
  const storedTime = await pool.query(
    "select requested_time from reservation_requests where id=$1",
    [acceptedId],
  );
  assert.equal(storedTime.rows[0].requested_time, "14:00:00");
  assert.equal(
    (
      await checkReservationAvailability(other, {
        date: "2099-06-19",
        time: "14:00",
        guestCount: 2,
      })
    ).acceptedGuestsInWindow,
    11,
    "CAPACITY must count real PostgreSQL HH:MM:SS values without a custom pg parser",
  );
  await pool.query("delete from reservation_requests where id=$1", [acceptedId]);
  const createdIds: string[] = [];
  try {
    const hkAccepted = await insertReservation(hk, { status: "accepted", guestCount: 11 });
    const otherAccepted = await insertReservation(other, { status: "accepted", guestCount: 5 });
    createdIds.push(hkAccepted, otherAccepted);
    const hkLoad = await checkReservationAvailability(hk, {
      date: "2099-06-19",
      time: "14:00",
      guestCount: 2,
    });
    const otherLoad = await checkReservationAvailability(other, {
      date: "2099-06-19",
      time: "14:00",
      guestCount: 2,
    });
    assert.equal(hkLoad.acceptedGuestsInWindow, 11);
    assert.equal(otherLoad.acceptedGuestsInWindow, 5);
    assert.equal(hkLoad.pendingGuestsInWindow, 8);
    assert.equal(otherLoad.pendingGuestsInWindow, 8);
    assert.equal(hkLoad.status, "bookable");
    assert.equal(otherLoad.status, "capacity_warning");
    assert.equal(otherLoad.hardBlocked, false);

    const date = "2099-06-26";
    for (const [time, status, guestCount] of [
      ["12:00", "accepted", 3],
      ["16:00:00", "pending", 5],
      ["12:00:01", "accepted", 7],
      ["15:59:59", "pending", 9],
      ["12:00:00.000001", "accepted", 2],
      ["16:00:00.000001", "pending", 4],
      ["14:00:00", "declined", 40],
      ["14:00:00", "cancelled", 40],
    ] as const) {
      createdIds.push(await insertReservation(other, { time, status, guestCount, date }));
    }
    createdIds.push(await insertReservation(hk, { date, guestCount: 40 }));
    createdIds.push(await insertReservation(other, { date: "2099-06-27", guestCount: 40 }));
    const boundaryLoad = await checkReservationAvailability(other, {
      date,
      time: "14:00",
      guestCount: 3,
    });
    assert.equal(boundaryLoad.acceptedGuestsInWindow, 9);
    assert.equal(boundaryLoad.pendingGuestsInWindow, 9);
    assert.equal(boundaryLoad.status, "capacity_warning");
    assert.equal(boundaryLoad.hardBlocked, false);
    assert.match(boundaryLoad.warnings[0], /offenen Anfragen/);
    const overCapacity = await checkReservationAvailability(other, {
      date,
      time: "14:00",
      guestCount: 4,
    });
    assert.match(overCapacity.warnings[0], /bestätigten Anfragen/);
    assert.equal(overCapacity.hardBlocked, false);
    const touching = await checkReservationAvailability(other, {
      date,
      time: "18:00",
      guestCount: 7,
    });
    assert.equal(touching.acceptedGuestsInWindow, 0);
    assert.equal(touching.pendingGuestsInWindow, 4);
    assert.equal(touching.status, "bookable");
    const atCapacity = await checkReservationAvailability(other, {
      date,
      time: "18:00",
      guestCount: 8,
    });
    assert.equal(atCapacity.status, "bookable");
  } finally {
    await pool.query("delete from reservation_requests where id=any($1::uuid[])", [createdIds]);
  }
  console.log(
    "PASS: CAPACITY golden cases, real PostgreSQL times/seconds/fractions, boundaries, per-venue counts and nonblocking warnings.",
  );
}

async function smtpChecks(hk: VenueContext, other: VenueContext) {
  const fixture = await createSmtpFixture({ mode: "plain" });
  const { messages } = fixture.state;
  const statesAtSmtpAck: string[] = [];
  let observedId = "";
  fixture.state.beforeAccept = async () => {
    const result = await pool.query("select status from reservation_requests where id=$1", [
      observedId,
    ]);
    statesAtSmtpAck.push(result.rows[0].status);
  };
  try {
    await updateSmtpSettings(
      hk,
      {
        smtpHost: "127.0.0.1",
        smtpPort: fixture.port,
        smtpUser: "fixture@example.invalid",
        smtpPassword: "fixture-smtp-password",
        smtpFromAddress: "fixture@example.invalid",
        smtpFromName: hk.name,
      },
      session,
    );
    await setting(hk.id, "reservation_notification_email", "staff@example.invalid");
    assert.equal((await getSmtpSettingsForUi(hk)).passwordSource, "database");
    assert.equal("password" in (await getSmtpSettingsForUi(hk)), false);
    assert.equal((await getSmtpSettings(other)).password, undefined);
    observedId = await insertReservation(hk);
    const input = {
      id: observedId,
      decision: "accept" as const,
      expectedStatus: "pending" as const,
      subject: "Zusage für Jörg bei Heidekönig",
      body: "Hiermit bestätigen wir Ihre Reservierung. Mit freundlichen Grüßen.",
    };
    for (const failure of ["auth", "recipient", "data", "disconnect"] as const) {
      fixture.state.rejection = failure;
      assert.equal((await sendReservationDecision(hk, input, session)).ok, false, failure);
      assert.equal(
        (await getAdminReservationDetail(hk, observedId))?.reservation.status,
        "pending",
        failure,
      );
      assert.equal(
        (await listOutgoingEmailsForReservation(hk, observedId))[0].smtpStatus,
        "failed",
      );
      assert.equal(messages.length, 0, "Failed sends must not be accepted by the sink");
    }
    fixture.state.rejection = null;
    assert.equal((await sendReservationDecision(hk, input, session)).ok, true);
    assert.deepEqual(statesAtSmtpAck, ["pending", "accepted"]);
    assert.equal((await getAdminReservationDetail(hk, observedId))?.reservation.status, "accepted");
    assert.equal(messages.length, 2);
    const decision = parseFixtureMessage(messages[0].raw);
    assert.equal(messages[0].from, "fixture@example.invalid");
    assert.deepEqual(messages[0].recipients, ["guest@example.invalid"]);
    assert.equal(decision.headers.get("from"), `${hk.name} <fixture@example.invalid>`);
    assert.equal(decision.headers.get("reply-to"), session.email);
    assert.equal(decision.headers.get("to"), "guest@example.invalid");
    assert.equal(decision.headers.get("subject"), input.subject);
    assert.ok(
      decision.parts.some((part) => part.type === "text/plain" && part.text.includes(input.body)),
    );
    assert.ok(
      decision.parts.some((part) => part.type === "text/html" && part.text.includes(input.body)),
    );
    const confirmed = parseFixtureMessage(messages[1].raw);
    const confirmedIcs = confirmed.parts.find((part) => part.type === "text/calendar");
    assert.ok(confirmedIcs);
    assert.match(confirmedIcs.text, /STATUS:CONFIRMED/);
    assert.match(
      confirmedIcs.text,
      new RegExp(`UID:${observedId}-accepted@heidekoenig-reservations`),
    );
    assert.match(confirmedIcs.text, /DTSTART:20990619T120000Z/);
    assert.match(confirmedIcs.disposition ?? "", /filename=.*\.ics/);
    const calendarData = {
      id: observedId,
      date: "2099-06-19",
      time: "14:00",
      guestCount: 8,
      guestName: "Jörg Groß",
      email: "guest@example.invalid",
      phone: "012345678",
      privacyAccepted: "true" as const,
      website: undefined,
    };
    const availability = await checkReservationAvailability(hk, {
      date: calendarData.date,
      time: calendarData.time,
      guestCount: 8,
    });
    const internal = await buildInternalReservationEmailContent(hk, calendarData, availability);
    await sendInternalReservationEmail(hk, calendarData, availability, internal);
    const guest = await buildGuestReservationReceiptEmailContent(hk, calendarData);
    await sendGuestReservationReceiptEmail(hk, calendarData, guest);
    assert.equal(messages.length, 4);
    const request = parseFixtureMessage(messages[2].raw);
    assert.deepEqual(messages[2].recipients, ["staff@example.invalid"]);
    assert.equal(request.headers.get("reply-to"), calendarData.email);
    const requestIcs = request.parts.find((part) => part.type === "text/calendar");
    assert.ok(requestIcs);
    assert.match(requestIcs.text, /STATUS:TENTATIVE/);
    assert.match(requestIcs.text, /Jörg Groß/);
    assert.match(requestIcs.text, /DTSTART:20990619T120000Z/);
    const receipt = parseFixtureMessage(messages[3].raw);
    assert.deepEqual(messages[3].recipients, [calendarData.email]);
    assert.equal(receipt.headers.get("reply-to"), undefined);
    assert.ok(
      receipt.parts.some((part) => part.type === "text/plain" && part.text.includes("Jörg Groß")),
    );
    assert.equal(
      receipt.parts.some((part) => part.type === "text/calendar"),
      false,
    );
    const beforeCount = messages.length;
    await assert.rejects(sendGuestReservationReceiptEmail(other, calendarData));
    assert.equal(messages.length, beforeCount);
    console.log(
      "PASS: isolated SMTP auth/RCPT/DATA/disconnect failures, guest-mail-first/status-second, MIME headers/UTF-8/ICS and no cross-venue send.",
    );
  } finally {
    await fixture.close();
  }

  for (const mode of ["starttls", "tls"] as const) {
    const secure = await createSmtpFixture({ mode, loginOnly: mode === "tls" });
    secure.state.accounts.set("other-fixture@example.invalid", "other-venue-smtp-password");
    try {
      for (const venue of [hk, other]) {
        await updateSmtpSettings(
          venue,
          {
            smtpHost: "127.0.0.1",
            smtpPort: secure.port,
            smtpUser:
              venue.id === hk.id ? "fixture@example.invalid" : "other-fixture@example.invalid",
            smtpPassword:
              venue.id === hk.id ? "fixture-smtp-password" : "other-venue-smtp-password",
            smtpFromAddress: `${venue.slug}@example.invalid`,
            smtpFromName: venue.name,
          },
          session,
        );
        const id = await insertReservation(venue);
        await sendGuestReservationDecisionEmail(venue, {
          id,
          guestName: "Jörg Groß",
          guestEmail: "guest@example.invalid",
          replyTo: "staff@example.invalid",
          subject: "Rückfrage für Jörg",
          body: "Grüße vom Heidekönig!",
        });
        await pool.query("delete from reservation_requests where id=$1", [id]);
      }
      assert.equal(secure.state.messages.length, 2);
      assert.ok(secure.state.messages.every((message) => message.encrypted));
      assert.ok(secure.state.authentications.every((auth) => auth.valid && auth.encrypted));
      assert.equal(secure.state.authentications[0].method, mode === "tls" ? "LOGIN" : "PLAIN");
      for (const [index, venue] of [hk, other].entries()) {
        const message = secure.state.messages[index];
        const parsed = parseFixtureMessage(message.raw);
        assert.equal(message.from, `${venue.slug}@example.invalid`);
        assert.deepEqual(message.recipients, ["guest@example.invalid"]);
        assert.equal(parsed.headers.get("from"), `${venue.name} <${venue.slug}@example.invalid>`);
        assert.equal(parsed.headers.get("reply-to"), "staff@example.invalid");
        assert.equal(parsed.headers.get("subject"), "Rückfrage für Jörg");
        assert.ok(
          parsed.parts.some(
            (part) => part.type === "text/plain" && part.text.includes("Grüße vom Heidekönig!"),
          ),
        );
      }
      await setting(hk.id, "smtp_password", encryptSecret("wrong-test-password"));
      await assert.rejects(sendSmtpTestEmail(hk, "test@example.invalid"));
      assert.equal(secure.state.messages.length, 2);
      await sendSmtpTestEmail(other, "test@example.invalid");
      assert.equal(
        secure.state.messages.length,
        3,
        "A bad HK secret must not affect the other venue",
      );
      await setting(hk.id, "smtp_password", encryptSecret("fixture-smtp-password"));
    } finally {
      await secure.close();
    }
    const untrusted = await createSmtpFixture({ mode, trusted: false });
    try {
      await setting(hk.id, "smtp_port", String(untrusted.port));
      await assert.rejects(
        sendSmtpTestEmail(hk, "test@example.invalid"),
        /self.signed|certificate/i,
      );
      assert.equal(
        untrusted.state.authentications.length,
        0,
        "Invalid certificate must fail before AUTH",
      );
      assert.equal(untrusted.state.messages.length, 0);
      const id = await insertReservation(hk);
      const failed = await sendReservationDecision(
        hk,
        {
          id,
          decision: "accept",
          expectedStatus: "pending",
          subject: "Certificate failure fixture",
          body: "Hiermit bestätigen wir Ihre Reservierung.",
        },
        session,
      );
      assert.equal(failed.ok, false);
      assert.equal((await getAdminReservationDetail(hk, id))?.reservation.status, "pending");
      assert.equal((await listOutgoingEmailsForReservation(hk, id))[0].smtpStatus, "failed");
      await pool.query("delete from reservation_requests where id=$1", [id]);
    } finally {
      await untrusted.close();
    }
    console.log(
      `PASS: ${mode} certificate validation, AUTH ${mode === "tls" ? "LOGIN" : "PLAIN"}, wrong credentials, UTF-8/envelopes and two-venue SMTP isolation.`,
    );
  }
}

async function cleanupChecks(hk: VenueContext, other: VenueContext) {
  await setting(other.id, "reservation_retention_days", "60");
  await pool.query("update venues set is_active=false where id=$1", [other.id]);
  const oldHk = await insertReservation(hk, { daysOld: 40 });
  const youngOther = await insertReservation(other, { daysOld: 40 });
  const oldOther = await insertReservation(other, { daysOld: 70 });
  for (const [venue, id] of [
    [hk, oldHk],
    [other, youngOther],
    [other, oldOther],
  ] as const) {
    await recordReservationOutgoingEmail(venue, {
      reservationRequestId: id,
      body: "Guest PII",
      recipient: "guest@example.invalid",
      subject: "Guest PII",
      smtpStatus: "failed",
      smtpError: "technical failure",
      type: "guest_question",
    });
    await pool.query(
      "insert into audit_log (venue_id,action,entity_type,entity_id,metadata) values ($1,'fixture','reservation_request',$2,'{\"guest\":\"PII\"}')",
      [venue.id, id],
    );
  }
  await pool.query(
    "insert into audit_log (action,entity_type,created_at) values ('fixture.old','security',now()-interval '100 days')",
  );
  const result = await runRetentionCleanup();
  assert.equal(result.reservationsAnonymized, 2);
  assert.equal(result.outgoingEmailsAnonymized, 2);
  assert.equal(result.auditLogsScrubbed, 2);
  assert.equal(result.auditLogsDeleted, 1);
  assert.equal((await getAdminReservationDetail(hk, oldHk))?.reservation.guestName, "Anonymisiert");
  assert.equal(
    (await getAdminReservationDetail(other, oldOther))?.reservation.guestName,
    "Anonymisiert",
  );
  assert.equal(
    (await getAdminReservationDetail(other, youngOther))?.reservation.guestName,
    "Fixture Guest",
  );
  assert.equal((await listOutgoingEmailsForReservation(other, oldOther))[0].body, "[anonymisiert]");
  const runtime = execFileSync(process.execPath, ["scripts/cleanup-reservations.mjs"], {
    encoding: "utf8",
  });
  assert.match(runtime, /Reservations anonymized: 0/);
  assert.match(runtime, new RegExp(`${hk.id}: 30 days;`));
  assert.match(runtime, new RegExp(`${other.id}: 60 days;`));
  await pool.query("update venues set is_active=true where id=$1", [other.id]);
  console.log(
    "PASS: per-venue retention including inactive venues, mail/audit scrubbing, global audit deletion and runtime idempotence.",
  );
}

async function webChecks(hk: VenueContext, other: VenueContext, foreignId: string) {
  if (process.env.MULTI_VENUE_WEB_TEST !== "true") return;
  execFileSync("npm", ["run", "build"], { stdio: "inherit" });
  await cp("public", ".next/standalone/public", { recursive: true });
  await cp(".next/static", ".next/standalone/.next/static", { recursive: true });
  const app = spawn(process.execPath, [".next/standalone/server.js"], {
    env: {
      ...process.env,
      NODE_ENV: "production",
      HOSTNAME: "0.0.0.0",
      PORT: "6143",
      TZ: "America/Los_Angeles",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let appLogs = "";
  app.stdout.on("data", (chunk) => {
    appLogs += chunk;
  });
  app.stderr.on("data", (chunk) => {
    appLogs += chunk;
  });
  const request = (path: string, headers: Record<string, string>) =>
    new Promise<{ status: number; body: string }>((resolve, reject) => {
      const req = httpRequest({ hostname: "127.0.0.1", port: 6143, path, headers }, (response) => {
        let body = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          body += chunk;
        });
        response.on("end", () => resolve({ status: response.statusCode ?? 0, body }));
      });
      req.setTimeout(10000, () => req.destroy(new Error("HTTP test timed out")));
      req.on("error", reject);
      req.end();
    });
  try {
    for (let attempt = 0; attempt < 100; attempt++) {
      try {
        if ((await request("/login", { Host: "login.gorms.de" })).status === 200) break;
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 100));
      if (attempt === 99) throw new Error(`Isolated Next server failed: ${appLogs}`);
    }
    await pool.query(
      "insert into app_settings (key,value) values ('setup_completed','true') on conflict (key) do update set value='true'",
    );
    const adminSession = await createSession(userId);
    const cookie = `heidekoenig_admin_session=${adminSession.token}; gorms_admin_venue=${other.id}`;
    assert.equal((await request("/", { Host: "xn--heideknig-57a.gorms.de" })).status, 200);
    assert.equal((await request("/", { Host: "unknown.test" })).status, 404);
    assert.equal((await request("/admin", { Host: "xn--heideknig-57a.gorms.de" })).status, 404);
    assert.equal((await request("/reservieren", { Host: "login.gorms.de" })).status, 404);
    assert.equal(
      (await request("/login", { Host: "login.gorms.de", Origin: "https://alias.hk.test" })).status,
      404,
    );
    assert.equal(
      (await request("/", { Host: "127.0.0.1", "X-Forwarded-Host": "unknown.test" })).status,
      404,
    );
    assert.equal(
      (
        await request("/", {
          Host: "unknown.test",
          "X-Forwarded-Host": "xn--heideknig-57a.gorms.de",
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await request(`/admin/reservations/${foreignId}`, {
          Host: "login.gorms.de",
          Cookie: cookie,
        })
      ).status,
      404,
    );
    assert.equal(
      (
        await request(`/admin/reservations/${foreignId}/ics/request`, {
          Host: "login.gorms.de",
          Cookie: cookie,
        })
      ).status,
      404,
    );
    assert.equal((await request("/branding/favicon", { Host: "unknown.test" })).status, 404);
    assert.equal((await request("/branding/favicon", { Host: "login.gorms.de" })).status, 200);
    assert.equal(
      (await request("/branding/logo", { Host: "login.gorms.de", Cookie: cookie })).status,
      404,
    );
    assert.equal(
      (await request("/branding/logo", { Host: "xn--heideknig-57a.gorms.de" })).status,
      200,
    );
    assert.equal(
      (
        await request("/api/reservation-slots?date=2026-02-30", {
          Host: "xn--heideknig-57a.gorms.de",
        })
      ).status,
      400,
    );
    const hkCookie = `heidekoenig_admin_session=${adminSession.token}; gorms_admin_venue=${hk.id}`;
    const calendarDate = "2099-06-19";
    const expectedDay = new Intl.DateTimeFormat("de-DE", {
      day: "2-digit",
      month: "2-digit",
      weekday: "short",
      timeZone: "UTC",
    }).format(new Date(`${calendarDate}T00:00:00Z`));
    assert.ok(
      (await request("/admin", { Host: "login.gorms.de", Cookie: hkCookie })).body.includes(
        expectedDay,
      ),
      "Dashboard calendar dates must not shift in a non-Berlin server timezone.",
    );
    await createBlockedDay(
      hk,
      { date: calendarDate, reason: "Calendar timezone fixture" },
      session,
    );
    const expectedBlockedDay = new Intl.DateTimeFormat("de-DE", {
      day: "2-digit",
      month: "2-digit",
      weekday: "short",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(`${calendarDate}T00:00:00Z`));
    assert.ok(
      (
        await request("/admin/blocked-days", { Host: "login.gorms.de", Cookie: hkCookie })
      ).body.includes(expectedBlockedDay),
      "Blocked-day calendar dates must not shift in a non-Berlin server timezone.",
    );
    const { chromium } = await import("playwright");
    const screenshotDir = "build/phase1-verification";
    await mkdir(screenshotDir, { recursive: true });
    const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
    try {
      for (const viewport of [
        { width: 1440, height: 1000 },
        { width: 390, height: 844 },
      ]) {
        const context = await browser.newContext({ viewport, timezoneId: "America/Los_Angeles" });
        const page = await context.newPage();
        await page.goto("http://127.0.0.1:6143/");
        await page.waitForSelector(".slot-loading-card", { state: "hidden", timeout: 120000 });
        assert.equal(
          await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
          false,
        );
        await page.screenshot({
          path: join(screenshotDir, `gorms-phase1-public-${viewport.width}.png`),
          fullPage: true,
        });
        await context.addCookies([
          {
            name: "heidekoenig_admin_session",
            value: adminSession.token,
            url: "http://localhost:6143",
            httpOnly: true,
            sameSite: "Lax",
          },
        ]);
        await page.goto("http://localhost:6143/admin");
        assert.equal(await page.locator('select[name="venueId"]').count(), 1);
        await page.goto("http://localhost:6143/admin/opening-hours");
        assert.equal(await page.locator('input[name="venueId"]').getAttribute("value"), hk.id);
        const before = (await getBusinessSettings(hk)).earliestReservationTime;
        const auditBefore = (
          await pool.query(
            "select count(*)::int as count from audit_log where action='opening_hours.update'",
          )
        ).rows[0].count;
        await context.addCookies([
          {
            name: "gorms_admin_venue",
            value: other.id,
            url: "http://localhost:6143",
            httpOnly: true,
            sameSite: "Lax",
          },
        ]);
        await page.locator('button[type="submit"]').last().click();
        await page.waitForLoadState("networkidle");
        assert.equal((await getBusinessSettings(hk)).earliestReservationTime, before);
        assert.equal((await getBusinessSettings(other)).earliestReservationTime, "12:00");
        assert.equal(
          (
            await pool.query(
              "select count(*)::int as count from audit_log where action='opening_hours.update'",
            )
          ).rows[0].count,
          auditBefore,
        );
        await page.goto("http://localhost:6143/admin/reservations");
        assert.equal(
          await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
          false,
        );
        await page.screenshot({
          path: join(screenshotDir, `gorms-phase1-admin-${viewport.width}.png`),
          fullPage: true,
        });
        await context.close();
      }
      await pool.query("update venues set is_active=false where id=$1", [other.id]);
      const context = await browser.newContext();
      await context.addCookies([
        {
          name: "heidekoenig_admin_session",
          value: adminSession.token,
          url: "http://localhost:6143",
          httpOnly: true,
        },
      ]);
      const page = await context.newPage();
      await page.goto("http://localhost:6143/admin");
      assert.equal(await page.locator('select[name="venueId"]').count(), 1);
      await context.close();
      await pool.query("update venues set is_active=true where id=$1", [other.id]);
    } finally {
      await browser.close();
    }
    const { checkTablePlanBrowser } = await import("./check-table-plan-browser");
    await checkTablePlanBrowser(adminSession.token, userId);
    console.log(
      "PASS: real Next routes, Host/Origin/forwarded protection, foreign details/ICS, public/admin branding, non-Berlin server calendar rendering, stale forms and desktop/mobile Playwright (screenshots in ignored build/phase1-verification).",
    );
  } finally {
    app.kill("SIGTERM");
    await once(app, "exit");
  }
}

async function phase2UpgradeChecks() {
  await resetDatabase();
  await migrateLegacy(4);
  await importLegacyPublicHosts(pool, {
    publicHosts: process.env.PUBLIC_ALLOWED_HOSTS,
    adminHosts: adminHosts.join(","),
  });
  await pool.query(
    "insert into users (id,email,name,password_hash,role) values ($1,'phase2-upgrade@example.invalid','Upgrade Fixture','not-a-real-password','admin')",
    [userId],
  );
  const cipher = encryptSecret("phase2-preserved-secret");
  await pool.query(
    "insert into venue_settings(venue_id,key,value,is_secret,updated_by_user_id,updated_at) values ($1,'smtp_password',$2,true,$3,'2026-06-01T12:34:56Z'),($1,'reservation_retention_days','30',false,$3,'2026-06-01T12:34:56Z')",
    [hkId, cipher, userId],
  );
  await pool.query(
    "insert into reservation_requests(venue_id,requested_date,requested_time,guest_name,guest_email,guest_phone,guest_count,status,privacy_acknowledged_at) values ($1,'2026-06-19','14:00:00','Upgrade Guest','upgrade@example.invalid','012345678',8,'accepted',now())",
    [hkId],
  );
  const existing = [
    "venues",
    "venue_hosts",
    "venue_settings",
    "app_settings",
    "users",
    "sessions",
    "reservation_requests",
    "blocked_days",
    "reservation_events",
    "reservation_availability_checks",
    "reservation_outgoing_emails",
    "audit_log",
  ];
  const snapshot = async (table: string) =>
    (await pool.query(`select to_jsonb(t) as data from ${table} t order by to_jsonb(t)::text`))
      .rows;
  const before = new Map<string, unknown>();
  for (const table of existing) before.set(table, await snapshot(table));
  for (const [id, slug] of [
    ["00000000-0000-4000-8000-000000000002", "conflicting-telegraph"],
    [randomUUID(), "telegraph"],
  ]) {
    await pool.query(
      "insert into venues(id,slug,name,short_name,time_zone,availability_strategy,is_active) values ($1,$2,'Conflicting Fixture','Conflict','Europe/Berlin','TABLES',true)",
      [id, slug],
    );
    assert.throws(
      () => runMigration(),
      "Conflicting bootstrap identities must abort the complete migration.",
    );
    assert.equal(
      (await pool.query("select to_regclass('public.venue_areas') as relation")).rows[0].relation,
      null,
    );
    await pool.query("delete from venues where id=$1", [id]);
    for (const table of existing) assert.deepEqual(await snapshot(table), before.get(table));
  }
  runMigration();
  for (const table of existing) {
    const after =
      table === "venues"
        ? (await pool.query("select to_jsonb(t) as data from venues t where id=$1", [hkId])).rows
        : await snapshot(table);
    assert.deepEqual(after, before.get(table), `Phase 2 must preserve Phase 1 ${table} exactly.`);
  }
  assert.equal((await getAdminSettings((await getVenueById(hkId))!)).reservationRetentionDays, 30);
  assert.equal(
    decryptSecret(
      (
        await pool.query(
          "select value from venue_settings where venue_id=$1 and key='smtp_password'",
          [hkId],
        )
      ).rows[0].value,
    ),
    "phase2-preserved-secret",
  );
  const allVenues = await snapshot("venues");
  const areas = await snapshot("venue_areas");
  runMigration();
  assert.deepEqual(await snapshot("venues"), allVenues);
  assert.deepEqual(await snapshot("venue_areas"), areas);
  console.log(
    "PASS: direct Phase 1 -> Phase 2 upgrade preserves all twelve existing tables, ciphertext, hosts and retention; conflicting IDs/slugs roll back, corrected retry and repeated migration are safe.",
  );
}

async function main() {
  try {
    await upgradeChecks();
    await retentionUpgradeChecks();
    await phase2UpgradeChecks();
    const { hk, other, id } = await isolationChecks();
    await capacityChecks(hk, other);
    await smtpChecks(hk, other);
    await cleanupChecks(hk, other);
    const { checkTablePlan } = await import("./check-table-plan");
    await checkTablePlan(session);
    await webChecks(hk, other, id);
    console.log("All isolated multi-venue integration checks passed.");
  } finally {
    await pool.end();
  }
}
void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
