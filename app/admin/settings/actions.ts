"use server";

import { revalidatePath } from "next/cache";
import { brandingSettingsSchema } from "@/src/lib/branding-validation";
import { adminSettingsSchema } from "@/src/lib/settings-validation";
import { smtpSettingsSchema, smtpTestSchema } from "@/src/lib/smtp-validation";
import {
  removeBrandingAsset,
  updateBrandingAsset,
  updateBrandingSettings,
} from "@/src/server/branding";
import { sendSmtpTestEmail } from "@/src/server/email";
import { requirePermission } from "@/src/server/guards";
import { checkRateLimit } from "@/src/server/rate-limit";
import { getClientRateLimitKey } from "@/src/server/request-security";
import { runRetentionCleanup } from "@/src/server/retention";
import { updateAdminSettings, updateSmtpSettings } from "@/src/server/settings";

export type SettingsActionState = {
  message?: string;
  fieldErrors?: Record<string, string[]>;
  success?: boolean;
};

export type RetentionCleanupActionState = SettingsActionState & {
  auditLogsDeleted?: number;
  outgoingEmailsAnonymized?: number;
  reservationsAnonymized?: number;
};

export async function updateSettingsAction(
  _previousState: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const session = await requirePermission("settings:manage");
  const parsed = adminSettingsSchema.safeParse({
    appName: formData.get("appName"),
    auditLogRetentionDays: formData.get("auditLogRetentionDays"),
    blockMondays: formData.get("blockMondays") === "true",
    blockPublicHolidays: formData.get("blockPublicHolidays") === "true",
    blockSundays: formData.get("blockSundays") === "true",
    blockTuesdays: formData.get("blockTuesdays") === "true",
    earliestReservationTime: formData.get("earliestReservationTime"),
    guestEmailSubjectTemplate: formData.get("guestEmailSubjectTemplate"),
    holidayCountry: formData.get("holidayCountry"),
    holidayState: formData.get("holidayState"),
    indoorCapacity: formData.get("indoorCapacity"),
    imprintUrl: formData.get("imprintUrl"),
    internalEmailSubjectTemplate: formData.get("internalEmailSubjectTemplate"),
    latestReservationBufferMinutes: formData.get("latestReservationBufferMinutes"),
    latestReservationTime: formData.get("latestReservationTime"),
    manualReviewGuestThreshold: formData.get("manualReviewGuestThreshold"),
    maxGuestsPerRequest: formData.get("maxGuestsPerRequest"),
    privacyContactEmail: formData.get("privacyContactEmail"),
    privacyNoticeText: formData.get("privacyNoticeText"),
    privacyPolicyUrl: formData.get("privacyPolicyUrl"),
    publicSiteUrl: formData.get("publicSiteUrl"),
    reservationNotificationEmail: formData.get("reservationNotificationEmail"),
    reservationSlotMinutes: formData.get("reservationSlotMinutes"),
    reservationRetentionDays: formData.get("reservationRetentionDays"),
    standardOccupancyMinutes: formData.get("standardOccupancyMinutes"),
    summerKitchenAcceptanceUntil: formData.get("summerKitchenAcceptanceUntil"),
    summerSeasonEnd: formData.get("summerSeasonEnd"),
    summerSeasonStart: formData.get("summerSeasonStart"),
    winterKitchenAcceptanceUntil: formData.get("winterKitchenAcceptanceUntil"),
  });

  if (!parsed.success) {
    return {
      fieldErrors: parsed.error.flatten().fieldErrors,
      message: "Bitte Eingaben prüfen.",
    };
  }

  await updateAdminSettings(parsed.data, session);

  revalidatePath("/admin/settings");
  revalidatePath("/admin/opening-hours");
  revalidatePath("/admin");

  return {
    message: "Einstellungen wurden gespeichert.",
    success: true,
  };
}

export async function updateSmtpSettingsAction(
  _previousState: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const session = await requirePermission("smtp:manage");
  const parsed = smtpSettingsSchema.safeParse({
    smtpFromAddress: formData.get("smtpFromAddress"),
    smtpFromName: formData.get("smtpFromName"),
    smtpHost: formData.get("smtpHost"),
    smtpPassword: formData.get("smtpPassword"),
    smtpPort: formData.get("smtpPort"),
    smtpUser: formData.get("smtpUser"),
  });

  if (!parsed.success) {
    return {
      fieldErrors: parsed.error.flatten().fieldErrors,
      message: "Bitte Eingaben prüfen.",
    };
  }

  try {
    await updateSmtpSettings(parsed.data, session);
  } catch {
    return { message: "SMTP-Einstellungen konnten nicht gespeichert werden." };
  }

  revalidatePath("/admin/settings");

  return {
    message: parsed.data.smtpPassword
      ? "SMTP-Einstellungen wurden gespeichert. Das Passwort wurde ersetzt."
      : "SMTP-Einstellungen wurden gespeichert. Das vorhandene Passwort bleibt unverändert.",
    success: true,
  };
}

export async function sendSmtpTestAction(
  _previousState: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  await requirePermission("smtp:manage");

  const rateLimitKey = await getClientRateLimitKey("smtp-test");

  if (!checkRateLimit(rateLimitKey, 5, 15 * 60 * 1000)) {
    return { message: "Bitte später erneut versuchen." };
  }

  const parsed = smtpTestSchema.safeParse({
    testEmail: formData.get("testEmail"),
  });

  if (!parsed.success) {
    return {
      fieldErrors: parsed.error.flatten().fieldErrors,
      message: "Bitte Eingaben prüfen.",
    };
  }

  try {
    await sendSmtpTestEmail(parsed.data.testEmail);
  } catch {
    return { message: "Testmail konnte nicht gesendet werden." };
  }

  return {
    message: "Testmail wurde gesendet.",
    success: true,
  };
}

export async function updateBrandingSettingsAction(
  _previousState: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const session = await requirePermission("branding:manage");
  const parsed = brandingSettingsSchema.safeParse({
    accentColor: formData.get("accentColor"),
  });

  if (!parsed.success) {
    return {
      fieldErrors: parsed.error.flatten().fieldErrors,
      message: "Bitte Eingaben prüfen.",
    };
  }

  await updateBrandingSettings(parsed.data, session);
  revalidatePath("/admin/settings");
  revalidatePath("/");
  revalidatePath("/reservieren");

  return {
    message: "Branding wurde gespeichert.",
    success: true,
  };
}

async function uploadBrandingAssetAction(formData: FormData, kind: "favicon" | "logo") {
  const session = await requirePermission("branding:manage");
  const file = formData.get(kind);

  if (!(file instanceof File)) {
    return { message: "Bitte eine Datei auswählen." };
  }

  const result = await updateBrandingAsset({ file, kind, session });

  if (!result.ok) {
    return { message: result.message };
  }

  revalidatePath("/admin/settings");
  revalidatePath("/");
  revalidatePath("/reservieren");

  return {
    message: `${kind === "logo" ? "Logo" : "Favicon"} wurde gespeichert.`,
    success: true,
  };
}

export async function uploadLogoAction(
  _previousState: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  return uploadBrandingAssetAction(formData, "logo");
}

export async function uploadFaviconAction(
  _previousState: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  return uploadBrandingAssetAction(formData, "favicon");
}

async function removeBrandingAssetAction(kind: "favicon" | "logo") {
  const session = await requirePermission("branding:manage");

  await removeBrandingAsset(kind, session);
  revalidatePath("/admin/settings");
  revalidatePath("/");
  revalidatePath("/reservieren");
}

export async function removeLogoAction() {
  await removeBrandingAssetAction("logo");
}

export async function removeFaviconAction() {
  await removeBrandingAssetAction("favicon");
}

export async function runRetentionCleanupAction(): Promise<RetentionCleanupActionState> {
  const session = await requirePermission("settings:manage");
  const result = await runRetentionCleanup({ session });

  revalidatePath("/admin/settings");
  revalidatePath("/admin/reservations");
  revalidatePath("/admin");

  return {
    auditLogsDeleted: result.auditLogsDeleted,
    message: "Bereinigung wurde abgeschlossen.",
    outgoingEmailsAnonymized: result.outgoingEmailsAnonymized,
    reservationsAnonymized: result.reservationsAnonymized,
    success: true,
  };
}
