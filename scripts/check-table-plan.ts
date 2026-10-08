import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { access, chmod, mkdir, readFile, symlink, utimes, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import sharp from "sharp";
import { pool } from "@/src/server/db";
import type { AuthenticatedSession } from "@/src/server/guards";
import { getAdminSelectableVenues, getVenueById } from "@/src/server/venues";
import { getSmtpSettings } from "@/src/server/settings";
import {
  assertTablePlanAccess,
  getTablePlan,
  listTablePlanAreas,
  saveTablePlan,
  saveTablePlanArea,
} from "@/src/server/table-plan";
import {
  floorplanPath,
  prepareFloorplan,
  readFloorplan,
  writeFloorplan,
} from "@/src/server/floorplans";
import { cleanupFloorplans } from "@/scripts/floorplan-cleanup-lib.mjs";
import { tablePlanSaveSchema } from "@/src/lib/table-plan-validation";
import { geometryFits, transferPlanAspect } from "@/src/lib/table-plan-geometry";
import {
  commitHistory,
  redoHistory,
  startHistory,
  undoHistory,
} from "@/src/lib/table-plan-history";
import { TELEGRAPH_VENUE_ID, TablePlanError, type TablePlan } from "@/src/lib/table-plan-types";
import { HEIDEKOENIG_VENUE_ID } from "@/src/lib/venue-defaults.mjs";
import { env } from "@/src/lib/env";
import { readBoundedMultipart } from "@/src/server/table-plan-http";

function input(
  plan: TablePlan,
  action: "keep" | "replace" | "remove" = "keep",
  acknowledged = false,
) {
  return {
    venueId: plan.venueId,
    baseRevision: plan.area.revision,
    aspectChangeAcknowledged: acknowledged,
    floorplanAction: action,
    plan,
  };
}
const status = (expected: number) => (error: unknown) =>
  error instanceof TablePlanError && error.status === expected;
const areaInput = (name: string) => ({
  name,
  sortOrder: 1,
  isActive: true,
  isOnlineBookable: false,
  archived: false,
});
const image = (width: number, height: number) =>
  sharp({
    create: { width, height, channels: 4, background: { r: 242, g: 246, b: 240, alpha: 1 } },
  });
const asFile = (data: Uint8Array, mime = "image/png", name = "fixture.png") =>
  new File([new Uint8Array(data)], name, { type: mime });

export async function checkTablePlan(session: AuthenticatedSession) {
  assert.equal(process.env.MULTI_VENUE_ISOLATED_TEST, "true");
  assert.equal(new URL(process.env.DATABASE_URL!).hostname, "phase1-db");
  assert.equal(Number(process.versions.node.split(".")[0]), 22);
  const venue = (await getVenueById(TELEGRAPH_VENUE_ID))!;
  const hk = (await getVenueById(HEIDEKOENIG_VENUE_ID))!;
  const foreignVenue = (await getVenueById("00000000-0000-4000-8000-000000000003"))!;
  assert.equal(venue.name, "Bistrot Telegraph");
  assert.equal(venue.availabilityStrategy, "TABLES");
  assert.equal(venue.timeZone, "Europe/Berlin");
  assert.equal(
    (await pool.query("select count(*)::int as n from venue_hosts where venue_id=$1", [venue.id]))
      .rows[0].n,
    0,
  );
  assert.equal(
    (
      await pool.query("select count(*)::int as n from venue_settings where venue_id=$1", [
        venue.id,
      ])
    ).rows[0].n,
    0,
  );
  assert.equal((await getSmtpSettings(venue)).password, undefined);
  assert((await getAdminSelectableVenues("admin")).some((v) => v.id === venue.id));
  assert(!(await getAdminSelectableVenues("mitarbeiter")).some((v) => v.id === venue.id));
  assert.throws(() => assertTablePlanAccess(hk, session), status(404));
  assert.throws(
    () => assertTablePlanAccess(venue, { ...session, role: "mitarbeiter" }),
    status(403),
  );
  assert.throws(() => assertTablePlanAccess({ ...venue, isActive: false }, session), status(404));
  const hkBefore = (
    await pool.query(
      "select to_jsonb(v) as data from venue_settings v where venue_id=$1 order by key",
      [hk.id],
    )
  ).rows;
  const areas = await listTablePlanAreas(venue, session);
  assert.equal(areas.length, 1);
  assert.equal(areas[0].name, "Gastraum");
  const areaId = areas[0].id;
  const otherArea = await saveTablePlanArea(venue, areaInput("Nebenraum"), session);
  const foreignArea = await saveTablePlanArea(foreignVenue, areaInput("Fremder Bereich"), session);
  await assert.rejects(saveTablePlanArea(venue, areaInput("NEBENRAUM"), session), status(400));
  let other = await getTablePlan(venue, otherArea, session);
  await saveTablePlanArea(
    venue,
    { ...areaInput("Nebenraum"), id: otherArea, baseRevision: other.area.revision, archived: true },
    session,
  );
  const reusedArea = await saveTablePlanArea(venue, areaInput("Nebenraum"), session);
  assert.notEqual(reusedArea, otherArea);
  other = await getTablePlan(venue, otherArea, session);
  await assert.rejects(
    saveTablePlanArea(
      venue,
      { ...areaInput("Nebenraum"), id: otherArea, baseRevision: other.area.revision },
      session,
    ),
    status(400),
  );
  await saveTablePlanArea(
    venue,
    { ...areaInput("Alter Nebenraum"), id: otherArea, baseRevision: other.area.revision },
    session,
  );
  await assert.rejects(getTablePlan(foreignVenue, areaId, session), status(404));
  await assert.rejects(
    saveTablePlanArea(
      venue,
      { ...areaInput("Fremder Bereich"), id: foreignArea, baseRevision: 0 },
      session,
    ),
    status(404),
  );

  let plan = await getTablePlan(venue, areaId, session);
  const ids = [randomUUID(), randomUUID(), randomUUID()];
  plan.tables = ids.map((id, n) => ({
    id,
    name: `T${n + 1}`,
    minGuests: 1,
    maxGuests: n === 2 ? 6 : 4,
    isActive: true,
    isOnlineBookable: true,
    isWheelchairAccessible: n === 0,
    archived: false,
    layout: {
      shape: n === 0 ? "round" : n === 1 ? "square" : "rectangle",
      x: 0.2 + n * 0.3,
      y: 0.4,
      width: 0.1,
      height: 0.1 * plan.background.aspectRatio,
      rotation: n === 2 ? 15 : 0,
      zOrder: n,
    },
  }));
  plan.combinations = [
    {
      id: randomUUID(),
      name: "K1",
      minGuests: 2,
      maxGuests: 8,
      isActive: true,
      isOnlineBookable: true,
      isWheelchairAccessible: true,
      archived: false,
      memberIds: ids.slice(0, 2),
    },
    {
      id: randomUUID(),
      name: "K2",
      minGuests: 2,
      maxGuests: 14,
      isActive: true,
      isOnlineBookable: true,
      isWheelchairAccessible: false,
      archived: false,
      memberIds: ids,
    },
  ];
  plan = await saveTablePlan(venue, areaId, input(plan), session);
  assert.deepEqual(await getTablePlan(venue, areaId, session), plan);
  assert.equal(plan.combinations[0].isWheelchairAccessible, true);
  assert.equal(plan.tables[0].isWheelchairAccessible, true);
  const originalRevision = plan.area.revision;
  const same = structuredClone(plan);
  const concurrent = await Promise.allSettled([
    saveTablePlan(venue, areaId, input(plan), session),
    saveTablePlan(venue, areaId, input(same), session),
  ]);
  assert.equal(concurrent.filter((r) => r.status === "fulfilled").length, 1);
  const conflict = concurrent.find((r) => r.status === "rejected") as PromiseRejectedResult;
  assert(status(409)(conflict.reason));
  plan = await getTablePlan(venue, areaId, session);
  assert.equal(plan.area.revision, originalRevision + 1);
  await assert.rejects(saveTablePlan(venue, areaId, input(same), session), status(409));

  for (const mutate of [
    (p: TablePlan) => {
      p.tables[0].layout.x = 1;
    },
    (p: TablePlan) => {
      p.tables[0].layout.x = Number.NaN;
    },
    (p: TablePlan) => {
      p.tables[0].layout.rotation = 360;
    },
    (p: TablePlan) => {
      p.tables[0].layout.height = 0.9;
    },
    (p: TablePlan) => {
      p.tables[0].maxGuests = 0;
    },
    (p: TablePlan) => {
      p.tables[1].name = "t1";
    },
    (p: TablePlan) => {
      p.combinations[0].memberIds = [ids[0], ids[0]];
    },
    (p: TablePlan) => {
      p.combinations[0].memberIds = [ids[0]];
    },
    (p: TablePlan) => {
      p.combinations[0].maxGuests = 100;
    },
    (p: TablePlan) => {
      p.combinations[0].memberIds = [ids[0], randomUUID()];
    },
  ]) {
    const invalid = structuredClone(plan);
    mutate(invalid);
    assert.equal(tablePlanSaveSchema.safeParse(input(invalid)).success, false);
  }
  await assert.rejects(
    saveTablePlan(venue, areaId, input({ ...plan, tables: plan.tables.slice(1) }), session),
    status(400),
  );
  await assert.rejects(saveTablePlan(foreignVenue, areaId, input(plan), session), status(404));

  const foreignTableId = randomUUID();
  const foreignPlan = await getTablePlan(foreignVenue, foreignArea, session);
  foreignPlan.tables = [{ ...plan.tables[0], id: foreignTableId }];
  await saveTablePlan(foreignVenue, foreignArea, input(foreignPlan), session);
  await assert.rejects(
    saveTablePlan(
      venue,
      areaId,
      input({
        ...plan,
        tables: [...plan.tables, { ...plan.tables[0], id: foreignTableId, name: "Fremd" }],
      }),
      session,
    ),
    status(404),
  );
  await assert.rejects(
    pool.query(
      "insert into table_combination_members(combination_id,table_id,area_id) values ($1,$2,$3)",
      [plan.combinations[0].id, foreignTableId, areaId],
    ),
    (e: unknown) => (e as { code: string }).code === "23503",
  );
  await assert.rejects(
    pool.query(
      "insert into table_combination_members(combination_id,table_id,area_id) values ($1,$2,$3)",
      [plan.combinations[0].id, ids[0], areaId],
    ),
    (e: unknown) => (e as { code: string }).code === "23505",
  );
  await assert.rejects(
    pool.query(
      "insert into table_combinations(id,area_id,name,min_guests,max_guests) values ($1,$2,'Nur ein Tisch',1,2)",
      [randomUUID(), areaId],
    ),
    (e: unknown) => (e as { code: string }).code === "23514",
  );
  await assert.rejects(
    pool.query("update table_combinations set max_guests=999 where id=$1", [
      plan.combinations[0].id,
    ]),
    (e: unknown) => (e as { code: string }).code === "23514",
  );

  await pool.query("update physical_tables set is_active=false, archived_at=now() where id=$1", [
    ids[0],
  ]);
  plan = await getTablePlan(venue, areaId, session);
  assert.equal(plan.combinations[0].isActive, true);
  assert.equal(plan.combinations[0].memberIds.length, 2);
  const replacementId = randomUUID();
  plan.tables.push({
    ...plan.tables[1],
    id: replacementId,
    name: "T1",
    layout: { ...plan.tables[1].layout, x: 0.5, y: 0.7, zOrder: 3 },
  });
  plan.combinations[0].archived = true;
  plan.combinations.push({ ...plan.combinations[0], id: randomUUID(), archived: false });
  plan = await saveTablePlan(venue, areaId, input(plan), session);
  const restore = structuredClone(plan);
  restore.tables[0].archived = false;
  await assert.rejects(saveTablePlan(venue, areaId, input(restore), session), status(400));
  restore.tables[0].name = "Historischer T1";
  plan = await saveTablePlan(venue, areaId, input(restore), session);
  plan.tables[2].maxGuests = 3;
  plan.combinations.find((c) => c.name === "K2")!.maxGuests = 11;
  plan = await saveTablePlan(venue, areaId, input(plan), session);
  console.log(
    "PASS: TABLES bootstrap/capabilities, partial names/restoration, ownership, combination DB/server integrity, archive-safe memberships, atomic capacities and concurrent 409.",
  );

  const png = await image(640, 480).png().toBuffer();
  for (const [bytes, mime] of [
    [png, "image/png"],
    [await image(640, 480).jpeg().toBuffer(), "image/jpeg"],
    [await image(640, 480).webp().toBuffer(), "image/webp"],
  ] as const) {
    const prepared = await prepareFloorplan(
      venue.id,
      areaId,
      asFile(bytes, mime, "../../unsafe.php"),
    );
    assert.equal(prepared.width, 640);
    assert.equal(prepared.height, 480);
    assert.equal(prepared.filePath.startsWith(`floorplans/${venue.id}/${areaId}/`), true);
    assert.equal(prepared.filePath.includes("unsafe"), false);
    assert.equal((await sharp(prepared.bytes).metadata()).format, "png");
    assert.equal((await sharp(prepared.bytes).metadata()).exif, undefined);
  }
  const oriented = await image(640, 480).jpeg().withMetadata({ orientation: 6 }).toBuffer();
  const rotated = await prepareFloorplan(venue.id, areaId, asFile(oriented, "image/jpeg"));
  assert.equal(rotated.width, 480);
  assert.equal(rotated.height, 640);
  for (const file of [
    asFile(Buffer.from("<svg></svg>"), "image/png"),
    asFile(png, "image/jpeg"),
    asFile(png.subarray(0, 20)),
    asFile(Buffer.alloc(8 * 1024 * 1024 + 1)),
    asFile(await image(63, 64).png().toBuffer()),
    asFile(await image(8193, 64).png().toBuffer()),
    asFile(await image(4096, 4097).png().toBuffer()),
  ])
    await assert.rejects(
      prepareFloorplan(venue.id, areaId, file),
      (e: unknown) => e instanceof TablePlanError && [400, 413].includes(e.status),
    );
  const animatedHeader = Buffer.concat([
    png.subarray(0, 8),
    Buffer.from([0, 0, 0, 0]),
    Buffer.from("acTL"),
    Buffer.alloc(4),
    png.subarray(8),
  ]);
  await assert.rejects(prepareFloorplan(venue.id, areaId, asFile(animatedHeader)), status(400));
  assert.throws(() => floorplanPath("floorplans/../../etc/passwd"), status(404));
  plan = await saveTablePlan(
    venue,
    areaId,
    input({ ...plan, background: { ...plan.background, asset: null } }, "replace"),
    session,
    asFile(png),
  );
  const firstAsset = plan.background.asset!;
  await assert.rejects(
    pool.query("update floorplan_assets set width=width+1 where id=$1", [firstAsset.id]),
    (e: unknown) => (e as { code: string }).code === "23514",
  );
  await assert.rejects(
    pool.query("update area_plan_layouts set floorplan_asset_id=$1 where area_id=$2", [
      firstAsset.id,
      foreignArea,
    ]),
    (e: unknown) => (e as { code: string }).code === "23503",
  );
  assert.equal((await readFloorplan(venue, areaId, firstAsset.id)).length > 0, true);
  await assert.rejects(readFloorplan(foreignVenue, areaId, firstAsset.id), status(404));
  await assert.rejects(readFloorplan(venue, foreignArea, firstAsset.id), status(404));
  const assetCount = (await pool.query("select count(*)::int as n from floorplan_assets")).rows[0]
    .n;
  const firstFile = (
    await pool.query("select file_path from floorplan_assets where id=$1", [firstAsset.id])
  ).rows[0].file_path;
  const directory = dirname(floorplanPath(firstFile));
  await chmod(directory, 0o555);
  try {
    await assert.rejects(
      saveTablePlan(
        venue,
        areaId,
        input({ ...plan, background: { ...plan.background, asset: null } }, "replace"),
        session,
        asFile(png),
      ),
    );
  } finally {
    await chmod(directory, 0o755);
  }
  assert.deepEqual(await getTablePlan(venue, areaId, session), plan);
  assert.equal(
    (await pool.query("select count(*)::int as n from floorplan_assets")).rows[0].n,
    assetCount,
  );
  const oversizedStream = new Request("http://isolated.invalid/save", {
    method: "POST",
    headers: { "Content-Type": "multipart/form-data; boundary=test" },
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(9 * 1024 * 1024 + 1));
        controller.close();
      },
    }),
    duplex: "half",
  } as RequestInit);
  await assert.rejects(readBoundedMultipart(oversizedStream), status(413));
  const duplicate = new FormData();
  duplicate.append("payload", "{}");
  duplicate.append("payload", "{}");
  await assert.rejects(
    readBoundedMultipart(
      new Request("http://isolated.invalid/save", { method: "POST", body: duplicate }),
    ),
    status(400),
  );

  const wall = (width: number, height: number) =>
    sharp({
      create: { width, height, channels: 4, background: { r: 116, g: 132, b: 119, alpha: 1 } },
    })
      .png()
      .toBuffer();
  const portrait = await image(640, 800)
    .composite([
      { input: await wall(588, 8), left: 26, top: 30 },
      { input: await wall(8, 720), left: 26, top: 30 },
      { input: await wall(8, 720), left: 606, top: 30 },
      { input: await wall(588, 8), left: 26, top: 750 },
      { input: await wall(280, 8), left: 26, top: 260 },
      { input: await wall(8, 186), left: 306, top: 30 },
    ])
    .png()
    .toBuffer();
  const transformed = transferPlanAspect(plan, 640 / 800);
  transformed.background.asset = null;
  for (const t of transformed.tables)
    assert(geometryFits(t.layout, transformed.background.aspectRatio));
  const a = plan.tables[1].layout;
  const b = transformed.tables[1].layout;
  assert(
    Math.abs(
      b.width / a.width -
        b.height / transformed.background.aspectRatio / (a.height / plan.background.aspectRatio),
    ) < 1e-6,
  );
  await assert.rejects(
    saveTablePlan(venue, areaId, input(transformed, "replace"), session, asFile(portrait)),
    status(400),
  );
  plan = await saveTablePlan(
    venue,
    areaId,
    input(transformed, "replace", true),
    session,
    asFile(portrait),
  );
  assert.equal(plan.background.aspectRatio, 0.8);
  assert.deepEqual(plan, await getTablePlan(venue, areaId, session));
  const activeAsset = plan.background.asset!;
  const history = commitHistory(startHistory(plan), {
    ...plan,
    tables: plan.tables.map((t, n) =>
      n ? t : { ...t, layout: { ...t.layout, x: t.layout.x + 0.01 } },
    ),
  });
  assert.equal(history.past.length, 1);
  assert.deepEqual(undoHistory(history).present, plan);
  assert.deepEqual(redoHistory(undoHistory(history)).present, history.present);
  assert.equal(commitHistory(history, history.present).past.length, 1);
  for (const aspect of [0.5, 1, 4 / 3, 2, 3]) {
    const shifted = transferPlanAspect(plan, aspect);
    assert(shifted.tables.every((t) => geometryFits(t.layout, aspect)));
    assert.equal(shifted.tables[0].maxGuests, plan.tables[0].maxGuests);
  }
  const metadata = (
    await pool.query("select * from floorplan_assets where id=$1", [activeAsset.id])
  ).rows[0];
  assert.equal(metadata.mime_type, "image/png");
  console.log(
    "PASS: full PNG/JPEG/WebP decode, metadata/orientation, malformed/animated/size/dimension/path rejection, private asset isolation, acknowledged natural-aspect transfer, exact canonical reload and history.",
  );

  await pool.query("update floorplan_assets set retired_at='2000-01-01Z' where id=$1", [
    activeAsset.id,
  ]);
  await pool.query("update venue_areas set archived_at=now() where id=$1", [areaId]);
  const orphan = await prepareFloorplan(venue.id, areaId, asFile(png));
  await writeFloorplan(orphan);
  const orphanPath = floorplanPath(orphan.filePath);
  await utimes(orphanPath, new Date("2000-01-01Z"), new Date("2000-01-01Z"));
  const youngOrphan = await prepareFloorplan(venue.id, areaId, asFile(png));
  await writeFloorplan(youngOrphan);
  const outside = join(env.UPLOAD_DIR, "unrelated.txt");
  await writeFile(outside, "not a floorplan");
  const unsafeLink = join(env.UPLOAD_DIR, "floorplans", randomUUID());
  await symlink(join(env.UPLOAD_DIR, "branding"), unsafeLink);
  const failClient = await pool.connect();
  const fakePool = {
    connect: async () => ({
      query: (...args: unknown[]) => {
        if (String(args[0]).includes("select a.*"))
          throw new Error("Simulated database failure before deletion");
        return (failClient.query as (...parameters: unknown[]) => Promise<unknown>)(...args);
      },
      release: () => failClient.release(),
    }),
  } as unknown as typeof pool;
  await assert.rejects(cleanupFloorplans(fakePool, { uploadDir: env.UPLOAD_DIR }));
  await access(orphanPath);
  const gc = await cleanupFloorplans(pool, { uploadDir: env.UPLOAD_DIR });
  assert.equal(gc.retiredAssets, 0);
  assert.equal(gc.orphanFiles, 1);
  await access(floorplanPath(metadata.file_path));
  await access(floorplanPath(youngOrphan.filePath));
  const futureGc = await cleanupFloorplans(pool, {
    uploadDir: env.UPLOAD_DIR,
    now: new Date(Date.now() + 49 * 3600000),
  });
  assert.equal(futureGc.retiredAssets, 1);
  await assert.rejects(readFloorplan(venue, areaId, firstAsset.id), status(404));
  await access(floorplanPath(metadata.file_path));
  await access(outside);
  await pool.query("update venue_areas set archived_at=null where id=$1", [areaId]);
  plan = await getTablePlan(venue, areaId, session);
  const removed = await saveTablePlan(
    venue,
    areaId,
    input({ ...plan, background: { ...plan.background, asset: null } }, "remove"),
    session,
  );
  assert.equal(removed.background.aspectRatio, 0.8);
  await access(floorplanPath(metadata.file_path));
  assert.equal((await cleanupFloorplans(pool, { uploadDir: env.UPLOAD_DIR })).retiredAssets, 0);
  const lockClient = await pool.connect();
  await lockClient.query("select pg_advisory_lock_shared(724186203)");
  let completed = false;
  const waiting = cleanupFloorplans(pool, {
    uploadDir: env.UPLOAD_DIR,
    now: new Date(Date.now() + 49 * 3600000),
  }).then((r) => {
    completed = true;
    return r;
  });
  await new Promise((r) => setTimeout(r, 100));
  assert.equal(completed, false);
  await access(floorplanPath(metadata.file_path));
  await lockClient.query("select pg_advisory_unlock_shared(724186203)");
  lockClient.release();
  await waiting;
  await assert.rejects(access(floorplanPath(metadata.file_path)));
  const finalPlan = await getTablePlan(venue, areaId, session);
  // Leave a representative immutable file for the isolated browser/backup checks.
  const finalAspect = 0.8;
  await saveTablePlan(
    venue,
    areaId,
    input(
      {
        ...finalPlan,
        background: { ...finalPlan.background, aspectRatio: finalAspect, asset: null },
      },
      "replace",
    ),
    session,
    asFile(portrait),
  );
  assert.deepEqual(
    (
      await pool.query(
        "select to_jsonb(v) as data from venue_settings v where venue_id=$1 order by key",
        [hk.id],
      )
    ).rows,
    hkBefore,
  );
  await mkdir(join(env.UPLOAD_DIR, "branding"), { recursive: true });
  assert.equal(await readFile(outside, "utf8"), "not a floorplan");
  console.log(
    "PASS: 48-hour retired/orphan GC, active pointer wins even for archived area/stale retired timestamp, young files and unrelated paths protected, DB failure fail-closed, shared backup lock and unchanged HK settings.",
  );
}
