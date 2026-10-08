import { randomUUID } from "node:crypto";
import { lstat, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import { and, eq } from "drizzle-orm";
import { areaPlanLayouts, floorplanAssets, venueAreas } from "@/db/schema";
import { env } from "@/src/lib/env";
import { TablePlanError } from "@/src/lib/table-plan-types";
import { db } from "@/src/server/db";
import type { VenueContext } from "@/src/server/venues";

export const FLOORPLAN_LOCK = 724186203;
export const FLOORPLAN_MAX_INPUT = 8 * 1024 * 1024;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
let decoding = false;

export type PreparedFloorplan = {
  id: string;
  bytes: Buffer;
  width: number;
  height: number;
  filePath: string;
};

export async function prepareFloorplan(
  venueId: string,
  areaId: string,
  file: File,
): Promise<PreparedFloorplan> {
  if (decoding)
    throw new TablePlanError(429, "Ein Grundriss wird gerade verarbeitet. Bitte kurz warten.");
  if (!file.size || file.size > FLOORPLAN_MAX_INPUT)
    throw new TablePlanError(413, "Grundrisse dürfen höchstens 8 MiB groß sein.");
  decoding = true;
  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    const png = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
    const webp =
      bytes.subarray(0, 4).toString() === "RIFF" && bytes.subarray(8, 12).toString() === "WEBP";
    const mime = png ? "image/png" : jpeg ? "image/jpeg" : webp ? "image/webp" : null;
    if (!mime || (file.type && file.type !== mime))
      throw new TablePlanError(400, "Bitte einen gültigen PNG-, JPEG- oder WebP-Grundriss wählen.");
    if (png) {
      let offset = 8;
      while (offset + 12 <= bytes.length) {
        const length = bytes.readUInt32BE(offset);
        if (bytes.subarray(offset + 4, offset + 8).toString() === "acTL")
          throw new TablePlanError(400, "Animierte Grundrisse sind nicht erlaubt.");
        offset += 12 + length;
      }
    }
    const image = sharp(bytes, { limitInputPixels: 16777216, failOn: "warning" });
    const info = await image.metadata();
    if (
      (info.pages ?? 1) !== 1 ||
      (info.width ?? 0) < 64 ||
      (info.height ?? 0) < 64 ||
      (info.width ?? 0) > 8192 ||
      (info.height ?? 0) > 8192
    )
      throw new TablePlanError(
        400,
        "Der Grundriss muss ein einzelnes Bild mit 64 bis 8192 Pixeln je Seite sein.",
      );
    const result = await image.rotate().png().toBuffer({ resolveWithObject: true });
    if (result.data.length > 33554432)
      throw new TablePlanError(413, "Der verarbeitete Grundriss ist zu groß.");
    const id = randomUUID();
    return {
      id,
      bytes: result.data,
      width: result.info.width,
      height: result.info.height,
      filePath: `floorplans/${venueId}/${areaId}/${id}.png`,
    };
  } catch (error) {
    if (error instanceof TablePlanError) throw error;
    throw new TablePlanError(400, "Der Grundriss konnte nicht sicher gelesen werden.");
  } finally {
    decoding = false;
  }
}

export function floorplanPath(filePath: string) {
  const parts = filePath.split("/");
  if (
    parts.length !== 4 ||
    parts[0] !== "floorplans" ||
    !uuid.test(parts[1]) ||
    !uuid.test(parts[2]) ||
    !uuid.test(parts[3].replace(/\.png$/, "")) ||
    !parts[3].endsWith(".png")
  )
    throw new TablePlanError(404, "Grundriss nicht gefunden.");
  return join(env.UPLOAD_DIR, ...parts);
}

async function checkFloorplanParents(filePath: string, create: boolean) {
  if (create) await mkdir(env.UPLOAD_DIR, { recursive: true, mode: 0o755 });
  let current = env.UPLOAD_DIR;
  const root = await lstat(current);
  if (!root.isDirectory() || root.isSymbolicLink())
    throw new TablePlanError(500, "Grundrissspeicher ist nicht verfügbar.");
  for (const part of filePath.split("/").slice(0, -1)) {
    current = join(current, part);
    if (create) await mkdir(current, { recursive: true, mode: 0o755 });
    const entry = await lstat(current);
    if (!entry.isDirectory() || entry.isSymbolicLink())
      throw new TablePlanError(500, "Grundrissspeicher ist nicht verfügbar.");
  }
}

export async function writeFloorplan(asset: PreparedFloorplan) {
  const path = floorplanPath(asset.filePath);
  await checkFloorplanParents(asset.filePath, true);
  const temporary = `${path}.pending`;
  await writeFile(temporary, asset.bytes, { flag: "wx", mode: 0o644 });
  await rename(temporary, path);
}

export async function readFloorplan(venue: VenueContext, areaId: string, assetId: string) {
  if (
    !venue.isActive ||
    venue.availabilityStrategy !== "TABLES" ||
    !uuid.test(areaId) ||
    !uuid.test(assetId)
  )
    throw new TablePlanError(404, "Grundriss nicht gefunden.");
  const [asset] = await db
    .select({ filePath: floorplanAssets.filePath })
    .from(floorplanAssets)
    .innerJoin(venueAreas, eq(venueAreas.id, floorplanAssets.areaId))
    .innerJoin(
      areaPlanLayouts,
      and(
        eq(areaPlanLayouts.areaId, venueAreas.id),
        eq(areaPlanLayouts.floorplanAssetId, floorplanAssets.id),
      ),
    )
    .where(
      and(
        eq(venueAreas.venueId, venue.id),
        eq(venueAreas.id, areaId),
        eq(floorplanAssets.id, assetId),
      ),
    )
    .limit(1);
  if (!asset) throw new TablePlanError(404, "Grundriss nicht gefunden.");
  const path = floorplanPath(asset.filePath);
  await checkFloorplanParents(asset.filePath, false);
  if (!(await lstat(path)).isFile() || (await lstat(path)).isSymbolicLink())
    throw new TablePlanError(404, "Grundriss nicht gefunden.");
  return new Uint8Array(await readFile(path));
}
