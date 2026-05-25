"use server";

import { revalidatePath } from "next/cache";
import { adminSettingsSchema } from "@/src/lib/settings-validation";
import { requirePermission } from "@/src/server/guards";
import { updateAdminSettings } from "@/src/server/settings";

export type SettingsActionState = {
  message?: string;
  fieldErrors?: Record<string, string[]>;
  success?: boolean;
};

export async function updateSettingsAction(
  _previousState: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const session = await requirePermission("settings:manage");
  const parsed = adminSettingsSchema.safeParse({
    appName: formData.get("appName"),
    auditLogRetentionDays: formData.get("auditLogRetentionDays"),
    blockSundays: formData.get("blockSundays") === "true",
    earliestReservationTime: formData.get("earliestReservationTime"),
    guestEmailSubjectTemplate: formData.get("guestEmailSubjectTemplate"),
    holidayCountry: formData.get("holidayCountry"),
    holidayState: formData.get("holidayState"),
    imprintUrl: formData.get("imprintUrl"),
    internalEmailSubjectTemplate: formData.get("internalEmailSubjectTemplate"),
    latestReservationTime: formData.get("latestReservationTime"),
    maxGuestsPerRequest: formData.get("maxGuestsPerRequest"),
    privacyContactEmail: formData.get("privacyContactEmail"),
    privacyNoticeText: formData.get("privacyNoticeText"),
    privacyPolicyUrl: formData.get("privacyPolicyUrl"),
    publicSiteUrl: formData.get("publicSiteUrl"),
    reservationNotificationEmail: formData.get("reservationNotificationEmail"),
    reservationRetentionDays: formData.get("reservationRetentionDays"),
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
