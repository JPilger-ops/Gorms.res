import { eq, inArray, sql } from "drizzle-orm";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { randomUUID } from "node:crypto";
import { appSettings, auditLog } from "@/db/schema";
import { env } from "@/src/lib/env";
import type { BrandingSettingsInput } from "@/src/lib/branding-validation";
import { db } from "@/src/server/db";
import type { AuthenticatedSession } from "@/src/server/guards";

const brandingKeys = [
  "branding_accent_color",
  "branding_logo_file",
  "branding_favicon_file",
] as const;
const uploadMaxBytes = 2 * 1024 * 1024;
const brandingDir = join(env.UPLOAD_DIR, "branding");

type BrandingAssetKind = "favicon" | "logo";

type DetectedImage = {
  extension: "ico" | "jpg" | "png" | "webp";
  mimeType: "image/jpeg" | "image/png" | "image/webp" | "image/x-icon";
};

export type BrandingSettings = {
  accentColor: string;
  faviconUrl?: string;
  logoUrl?: string;
};

function detectImage(buffer: Buffer, kind: BrandingAssetKind): DetectedImage | null {
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return { extension: "png", mimeType: "image/png" };
  }

  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { extension: "jpg", mimeType: "image/jpeg" };
  }

  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return { extension: "webp", mimeType: "image/webp" };
  }

  if (
    kind === "favicon" &&
    buffer.length >= 4 &&
    buffer[0] === 0x00 &&
    buffer[1] === 0x00 &&
    buffer[2] === 0x01 &&
    buffer[3] === 0x00
  ) {
    return { extension: "ico", mimeType: "image/x-icon" };
  }

  return null;
}

function assetKey(kind: BrandingAssetKind) {
  return kind === "logo" ? "branding_logo_file" : "branding_favicon_file";
}

function assetUrl(kind: BrandingAssetKind, fileName: string | undefined) {
  return fileName ? `/branding/${kind}` : undefined;
}

async function getBrandingSettingMap() {
  const rows = await db
    .select({ key: appSettings.key, value: appSettings.value })
    .from(appSettings)
    .where(inArray(appSettings.key, [...brandingKeys]));

  return new Map(rows.map((row) => [row.key, row.value]));
}

async function deletePreviousFile(fileName: string | undefined) {
  if (!fileName) {
    return;
  }

  await rm(join(brandingDir, basename(fileName)), { force: true });
}

export async function getBrandingSettings(): Promise<BrandingSettings> {
  const settings = await getBrandingSettingMap();

  return {
    accentColor: settings.get("branding_accent_color") ?? "#234235",
    faviconUrl: assetUrl("favicon", settings.get("branding_favicon_file")),
    logoUrl: assetUrl("logo", settings.get("branding_logo_file")),
  };
}

export async function getBrandingAsset(kind: BrandingAssetKind) {
  const settings = await getBrandingSettingMap();
  const fileName = settings.get(assetKey(kind));

  if (!fileName) {
    return null;
  }

  const filePath = join(brandingDir, basename(fileName));
  const file = await readFile(filePath);
  const detected = detectImage(file, kind);

  if (!detected) {
    return null;
  }

  return {
    bytes: file,
    mimeType: detected.mimeType,
  };
}

export async function updateBrandingSettings(
  input: BrandingSettingsInput,
  session: AuthenticatedSession,
) {
  await db.transaction(async (tx) => {
    await tx
      .insert(appSettings)
      .values({
        key: "branding_accent_color",
        value: input.accentColor,
        isSecret: false,
        updatedByUserId: session.userId,
      })
      .onConflictDoUpdate({
        target: appSettings.key,
        set: {
          isSecret: false,
          updatedByUserId: session.userId,
          updatedAt: new Date(),
          value: sql<string>`excluded.value`,
        },
      });

    await tx.insert(auditLog).values({
      userId: session.userId,
      action: "branding.update",
      entityType: "app_settings",
      entityId: "branding",
      metadata: { keys: ["branding_accent_color"] },
    });
  });
}

export async function updateBrandingAsset({
  file,
  kind,
  session,
}: {
  file: File;
  kind: BrandingAssetKind;
  session: AuthenticatedSession;
}) {
  if (!file.size || file.size > uploadMaxBytes) {
    return { ok: false as const, message: "Datei ist leer oder größer als 2 MB." };
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const detected = detectImage(bytes, kind);

  if (!detected) {
    return { ok: false as const, message: "Dateityp ist nicht erlaubt." };
  }

  await mkdir(brandingDir, { recursive: true, mode: 0o755 });

  const settings = await getBrandingSettingMap();
  const previousFileName = settings.get(assetKey(kind));
  const nextFileName = `${kind}-${randomUUID()}.${detected.extension}`;

  await writeFile(join(brandingDir, nextFileName), bytes, { flag: "wx", mode: 0o644 });

  await db.transaction(async (tx) => {
    await tx
      .insert(appSettings)
      .values({
        key: assetKey(kind),
        value: nextFileName,
        isSecret: false,
        updatedByUserId: session.userId,
      })
      .onConflictDoUpdate({
        target: appSettings.key,
        set: {
          isSecret: false,
          updatedByUserId: session.userId,
          updatedAt: new Date(),
          value: sql<string>`excluded.value`,
        },
      });

    await tx.insert(auditLog).values({
      userId: session.userId,
      action: `branding.${kind}.upload`,
      entityType: "app_settings",
      entityId: assetKey(kind),
      metadata: {
        mimeType: detected.mimeType,
        size: file.size,
      },
    });
  });

  await deletePreviousFile(previousFileName);

  return { ok: true as const };
}

export async function removeBrandingAsset(kind: BrandingAssetKind, session: AuthenticatedSession) {
  const settings = await getBrandingSettingMap();
  const previousFileName = settings.get(assetKey(kind));

  await db.transaction(async (tx) => {
    await tx.delete(appSettings).where(eq(appSettings.key, assetKey(kind)));

    await tx.insert(auditLog).values({
      userId: session.userId,
      action: `branding.${kind}.remove`,
      entityType: "app_settings",
      entityId: assetKey(kind),
      metadata: {},
    });
  });

  await deletePreviousFile(previousFileName);
}
