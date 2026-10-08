import { randomUUID } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import {
  areaPlanLayouts,
  auditLog,
  floorplanAssets,
  physicalTables,
  tableCombinationMembers,
  tableCombinations,
  tableLayouts,
  venueAreas,
} from "@/db/schema";
import { db } from "@/src/server/db";
import type { VenueContext } from "@/src/server/venues";
import type { AuthenticatedSession } from "@/src/server/guards";
import { hasPermission } from "@/src/lib/permissions";
import { areaInputSchema, parseTablePlanSave } from "@/src/lib/table-plan-validation";
import {
  DEFAULT_PLAN_ASPECT_RATIO,
  TablePlanError,
  type PlanArea,
  type TablePlan,
} from "@/src/lib/table-plan-types";
import { FLOORPLAN_LOCK, prepareFloorplan, writeFloorplan } from "@/src/server/floorplans";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function assertTablePlanAccess(venue: VenueContext, session: AuthenticatedSession) {
  if (!hasPermission(session.role, "table-plan:manage"))
    throw new TablePlanError(403, "Keine Berechtigung für die Tischplanverwaltung.");
  if (!venue.isActive || venue.availabilityStrategy !== "TABLES")
    throw new TablePlanError(404, "Tischplan ist für diesen Betrieb nicht verfügbar.");
}

function areaDto(area: typeof venueAreas.$inferSelect): PlanArea {
  return {
    id: area.id,
    name: area.name,
    sortOrder: area.sortOrder,
    isActive: area.isActive,
    isOnlineBookable: area.isOnlineBookable,
    archived: Boolean(area.archivedAt),
    revision: area.revision,
  };
}

export async function listTablePlanAreas(venue: VenueContext, session: AuthenticatedSession) {
  assertTablePlanAccess(venue, session);
  return (
    await db
      .select()
      .from(venueAreas)
      .where(eq(venueAreas.venueId, venue.id))
      .orderBy(venueAreas.sortOrder, venueAreas.name)
  ).map(areaDto);
}

export async function getTablePlan(
  venue: VenueContext,
  areaId: string,
  session: AuthenticatedSession,
): Promise<TablePlan> {
  assertTablePlanAccess(venue, session);
  if (!uuid.test(areaId)) throw new TablePlanError(404, "Bereich nicht gefunden.");
  // A repeatable snapshot prevents a read spanning two completed plan saves.
  return db.transaction(
    async (tx) => {
      const [area] = await tx
        .select()
        .from(venueAreas)
        .where(and(eq(venueAreas.id, areaId), eq(venueAreas.venueId, venue.id)));
      if (!area) throw new TablePlanError(404, "Bereich nicht gefunden.");
      const [background] = await tx
        .select()
        .from(areaPlanLayouts)
        .where(eq(areaPlanLayouts.areaId, areaId));
      const tables = await tx
        .select()
        .from(physicalTables)
        .innerJoin(tableLayouts, eq(tableLayouts.tableId, physicalTables.id))
        .where(eq(physicalTables.areaId, areaId))
        .orderBy(tableLayouts.zOrder, physicalTables.id);
      const combinations = await tx
        .select()
        .from(tableCombinations)
        .where(eq(tableCombinations.areaId, areaId))
        .orderBy(tableCombinations.name, tableCombinations.id);
      const members = await tx
        .select()
        .from(tableCombinationMembers)
        .where(eq(tableCombinationMembers.areaId, areaId))
        .orderBy(tableCombinationMembers.tableId);
      const [asset] = background.floorplanAssetId
        ? await tx
            .select()
            .from(floorplanAssets)
            .where(
              and(
                eq(floorplanAssets.id, background.floorplanAssetId),
                eq(floorplanAssets.areaId, areaId),
              ),
            )
        : [];
      const resource = (t: typeof physicalTables.$inferSelect) => ({
        id: t.id,
        name: t.name,
        minGuests: t.minGuests,
        maxGuests: t.maxGuests,
        isActive: t.isActive,
        isOnlineBookable: t.isOnlineBookable,
        isWheelchairAccessible: t.isWheelchairAccessible,
        archived: Boolean(t.archivedAt),
      });
      return {
        venueId: venue.id,
        area: areaDto(area),
        background: {
          aspectRatio: background.aspectRatio,
          scale: background.backgroundScale,
          x: background.backgroundX,
          y: background.backgroundY,
          opacity: background.backgroundOpacity,
          asset: asset ? { id: asset.id, width: asset.width, height: asset.height } : null,
        },
        tables: tables.map(({ physical_tables: t, table_layouts: l }) => ({
          ...resource(t),
          layout: {
            shape: l.shape as "round" | "square" | "rectangle",
            x: l.x,
            y: l.y,
            width: l.width,
            height: l.height,
            rotation: l.rotation,
            zOrder: l.zOrder,
          },
        })),
        combinations: combinations.map((c) => ({
          ...resource(c),
          memberIds: members.filter((m) => m.combinationId === c.id).map((m) => m.tableId),
        })),
      };
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}

export function tablePlanDatabaseError(error: unknown): never {
  if (error instanceof TablePlanError) throw error;
  const candidate = error as { code?: string; cause?: { code?: string } };
  const code = candidate.code ?? candidate.cause?.code;
  if (code === "23505")
    throw new TablePlanError(
      400,
      "Dieser Name wird bereits verwendet. Bitte auch beim Wiederherstellen einen freien Namen wählen.",
    );
  if (code === "23503" || code === "23514")
    throw new TablePlanError(
      400,
      "Mitgliedschaften, Kapazitäten oder Referenzen sind ungültig. Bitte den Plan prüfen.",
    );
  throw error;
}

export async function saveTablePlanArea(
  venue: VenueContext,
  value: unknown,
  session: AuthenticatedSession,
) {
  assertTablePlanAccess(venue, session);
  const parsed = areaInputSchema.safeParse(value);
  if (!parsed.success)
    throw new TablePlanError(400, "Bitte Namen und Bereichseigenschaften prüfen.");
  const input = parsed.data;
  const id = input.id ?? randomUUID();
  try {
    await db.transaction(async (tx) => {
      const now = new Date();
      const data = {
        name: input.name,
        sortOrder: input.sortOrder,
        isActive: input.isActive,
        isOnlineBookable: input.isOnlineBookable,
        archivedAt: input.archived ? now : null,
        updatedAt: now,
      };
      if (input.id) {
        const [existing] = await tx
          .select()
          .from(venueAreas)
          .where(and(eq(venueAreas.id, id), eq(venueAreas.venueId, venue.id)))
          .for("update");
        if (!existing) throw new TablePlanError(404, "Bereich nicht gefunden.");
        if (input.baseRevision !== existing.revision)
          throw new TablePlanError(
            409,
            "Der Bereich wurde zwischenzeitlich geändert. Bitte neu laden.",
          );
        await tx
          .update(venueAreas)
          .set({
            ...data,
            archivedAt: input.archived ? (existing.archivedAt ?? now) : null,
            revision: existing.revision + 1,
          })
          .where(eq(venueAreas.id, id));
      } else {
        await tx.insert(venueAreas).values({ id, venueId: venue.id, ...data });
        await tx
          .insert(areaPlanLayouts)
          .values({ areaId: id, aspectRatio: DEFAULT_PLAN_ASPECT_RATIO });
      }
      await tx.insert(auditLog).values({
        venueId: venue.id,
        userId: session.userId,
        action: input.id ? "table_plan.area.update" : "table_plan.area.create",
        entityType: "venue_area",
        entityId: id,
        metadata: { structural: true, archived: input.archived },
      });
    });
  } catch (error) {
    tablePlanDatabaseError(error);
  }
  return id;
}

export async function saveTablePlan(
  venue: VenueContext,
  areaId: string,
  value: unknown,
  session: AuthenticatedSession,
  file?: File,
) {
  assertTablePlanAccess(venue, session);
  const input = parseTablePlanSave(value);
  if (
    input.venueId !== venue.id ||
    input.plan.venueId !== venue.id ||
    input.plan.area.id !== areaId ||
    input.plan.area.revision !== input.baseRevision
  )
    throw new TablePlanError(404, "Plan gehört nicht zu diesem Betrieb oder Bereich.");
  if ((input.floorplanAction === "replace") !== Boolean(file))
    throw new TablePlanError(400, "Grundriss-Aktion und Datei stimmen nicht überein.");
  const previous = await getTablePlan(venue, areaId, session);
  if (previous.area.revision !== input.baseRevision)
    throw new TablePlanError(
      409,
      "Der Plan wurde zwischenzeitlich geändert. Ihr Entwurf bleibt erhalten.",
    );
  const asset = file ? await prepareFloorplan(venue.id, areaId, file) : null;
  const nextAsset = asset ?? (input.floorplanAction === "keep" ? previous.background.asset : null);
  const aspect = asset ? asset.width / asset.height : previous.background.aspectRatio;
  if (Math.abs(input.plan.background.aspectRatio - aspect) > 1e-8)
    throw new TablePlanError(400, "Das Planformat passt nicht zum Grundriss.");
  if (
    Math.abs(aspect - previous.background.aspectRatio) > 1e-8 &&
    previous.tables.length &&
    !input.aspectChangeAcknowledged
  )
    throw new TablePlanError(
      400,
      "Den Wechsel des Seitenverhältnisses bitte ausdrücklich bestätigen.",
    );
  if (
    input.floorplanAction === "keep" &&
    input.plan.background.asset?.id !== previous.background.asset?.id
  )
    throw new TablePlanError(400, "Der Grundriss wurde zwischenzeitlich geändert.");
  const plan = input.plan;
  try {
    await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock_shared(${FLOORPLAN_LOCK})`);
      const [area] = await tx
        .select()
        .from(venueAreas)
        .where(and(eq(venueAreas.id, areaId), eq(venueAreas.venueId, venue.id)))
        .for("update");
      if (!area) throw new TablePlanError(404, "Bereich nicht gefunden.");
      if (area.revision !== input.baseRevision)
        throw new TablePlanError(
          409,
          "Der Plan wurde zwischenzeitlich geändert. Ihr Entwurf bleibt erhalten. Bitte den aktuellen Plan neu laden.",
        );
      const currentTables = await tx
        .select()
        .from(physicalTables)
        .where(eq(physicalTables.areaId, areaId));
      const currentCombinations = await tx
        .select()
        .from(tableCombinations)
        .where(eq(tableCombinations.areaId, areaId));
      if (
        currentTables.some((t) => !plan.tables.some((n) => n.id === t.id)) ||
        currentCombinations.some((t) => !plan.combinations.some((n) => n.id === t.id))
      )
        throw new TablePlanError(
          400,
          "Gespeicherte Ressourcen müssen archiviert statt entfernt werden.",
        );
      const newTables = plan.tables.filter((t) => !currentTables.some((old) => old.id === t.id));
      const newCombinations = plan.combinations.filter(
        (t) => !currentCombinations.some((old) => old.id === t.id),
      );
      for (const [table, entries] of [
        [physicalTables, newTables],
        [tableCombinations, newCombinations],
      ] as const) {
        if (
          entries.length &&
          (
            await tx
              .select({ id: table.id })
              .from(table)
              .where(
                inArray(
                  table.id,
                  entries.map((t) => t.id),
                ),
              )
          ).length
        )
          throw new TablePlanError(404, "Eine Ressource gehört nicht zu diesem Bereich.");
      }
      const now = new Date();
      if (asset) {
        await writeFloorplan(asset);
        await tx.insert(floorplanAssets).values({
          id: asset.id,
          areaId,
          filePath: asset.filePath,
          width: asset.width,
          height: asset.height,
          byteSize: asset.bytes.length,
        });
      }
      if (previous.background.asset && previous.background.asset.id !== nextAsset?.id)
        await tx
          .update(floorplanAssets)
          .set({ retiredAt: now })
          .where(
            and(
              eq(floorplanAssets.id, previous.background.asset.id),
              eq(floorplanAssets.areaId, areaId),
            ),
          );
      // Temporarily release partial name indexes so a single save can rename/swap resources.
      await tx
        .update(physicalTables)
        .set({ archivedAt: now })
        .where(eq(physicalTables.areaId, areaId));
      await tx
        .update(tableCombinations)
        .set({ archivedAt: now })
        .where(eq(tableCombinations.areaId, areaId));
      for (const t of plan.tables) {
        const old = currentTables.find((e) => e.id === t.id);
        const data = {
          name: t.name,
          minGuests: t.minGuests,
          maxGuests: t.maxGuests,
          isActive: t.isActive,
          isOnlineBookable: t.isOnlineBookable,
          isWheelchairAccessible: t.isWheelchairAccessible,
          archivedAt: t.archived ? (old?.archivedAt ?? now) : null,
          updatedAt: now,
        };
        if (old)
          await tx
            .update(physicalTables)
            .set(data)
            .where(and(eq(physicalTables.id, t.id), eq(physicalTables.areaId, areaId)));
        else await tx.insert(physicalTables).values({ id: t.id, areaId, ...data });
        await tx
          .insert(tableLayouts)
          .values({ tableId: t.id, ...t.layout })
          .onConflictDoUpdate({ target: tableLayouts.tableId, set: t.layout });
      }
      await tx.delete(tableCombinationMembers).where(eq(tableCombinationMembers.areaId, areaId));
      for (const c of plan.combinations) {
        const old = currentCombinations.find((e) => e.id === c.id);
        const data = {
          name: c.name,
          minGuests: c.minGuests,
          maxGuests: c.maxGuests,
          isActive: c.isActive,
          isOnlineBookable: c.isOnlineBookable,
          isWheelchairAccessible: c.isWheelchairAccessible,
          archivedAt: c.archived ? (old?.archivedAt ?? now) : null,
          updatedAt: now,
        };
        if (old)
          await tx
            .update(tableCombinations)
            .set(data)
            .where(and(eq(tableCombinations.id, c.id), eq(tableCombinations.areaId, areaId)));
        else await tx.insert(tableCombinations).values({ id: c.id, areaId, ...data });
        await tx
          .insert(tableCombinationMembers)
          .values(c.memberIds.map((tableId) => ({ combinationId: c.id, tableId, areaId })));
      }
      await tx
        .update(areaPlanLayouts)
        .set({
          aspectRatio: aspect,
          floorplanAssetId: nextAsset?.id ?? null,
          backgroundScale: plan.background.scale,
          backgroundX: plan.background.x,
          backgroundY: plan.background.y,
          backgroundOpacity: plan.background.opacity,
        })
        .where(eq(areaPlanLayouts.areaId, areaId));
      await tx
        .update(venueAreas)
        .set({
          name: plan.area.name,
          sortOrder: plan.area.sortOrder,
          isActive: plan.area.isActive,
          isOnlineBookable: plan.area.isOnlineBookable,
          archivedAt: plan.area.archived ? (area.archivedAt ?? now) : null,
          revision: area.revision + 1,
          updatedAt: now,
        })
        .where(eq(venueAreas.id, areaId));
      const logical = (p: TablePlan) => ({
        area: { ...p.area, revision: 0 },
        tables: p.tables.map((t) => ({
          id: t.id,
          name: t.name,
          minGuests: t.minGuests,
          maxGuests: t.maxGuests,
          isActive: t.isActive,
          isOnlineBookable: t.isOnlineBookable,
          isWheelchairAccessible: t.isWheelchairAccessible,
          archived: t.archived,
        })),
        combinations: p.combinations,
      });
      const structural = JSON.stringify(logical(previous)) !== JSON.stringify(logical(plan));
      const visualData = (p: TablePlan) => ({
        background: p.background,
        tables: p.tables.map((t) => ({ id: t.id, layout: t.layout })),
      });
      const visual =
        JSON.stringify(visualData(previous)) !==
        JSON.stringify(
          visualData({ ...plan, background: { ...plan.background, asset: nextAsset } }),
        );
      await tx.insert(auditLog).values({
        venueId: venue.id,
        userId: session.userId,
        action: "table_plan.save",
        entityType: "venue_area",
        entityId: areaId,
        metadata: {
          revision: area.revision + 1,
          structural,
          visual,
          tables: plan.tables.length,
          combinations: plan.combinations.length,
          floorplanAction: input.floorplanAction,
        },
      });
    });
  } catch (error) {
    // A failed/uncertain commit leaves an unreferenced immutable file for fail-closed GC.
    tablePlanDatabaseError(error);
  }
  return getTablePlan(venue, areaId, session);
}
