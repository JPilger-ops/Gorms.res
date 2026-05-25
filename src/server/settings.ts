import { inArray, sql } from "drizzle-orm";
import { appSettings, auditLog } from "@/db/schema";
import { env } from "@/src/lib/env";
import type { OpeningHoursInput } from "@/src/lib/opening-hours-validation";
import type { AdminSettingsInput } from "@/src/lib/settings-validation";
import { db } from "@/src/server/db";
import type { AuthenticatedSession } from "@/src/server/guards";

export type BusinessSettings = {
  blockSundays: boolean;
  earliestReservationTime: string;
  holidayCountry: string;
  holidayState: string;
  latestReservationTime: string;
  maxGuestsPerRequest: number;
};

export type EmailTemplateSettings = {
  guestEmailSubjectTemplate: string;
  internalEmailSubjectTemplate: string;
  reservationNotificationEmail: string;
};

export type AdminSettings = BusinessSettings &
  EmailTemplateSettings & {
    appName: string;
    auditLogRetentionDays: number;
    imprintUrl?: string;
    privacyContactEmail?: string;
    privacyNoticeText: string;
    privacyPolicyUrl?: string;
    publicSiteUrl: string;
    reservationRetentionDays: number;
  };

const settingKeys = [
  "block_sundays",
  "earliest_reservation_time",
  "holiday_country",
  "holiday_state",
  "latest_reservation_time",
  "max_guests_per_request",
] as const;

const emailTemplateSettingKeys = [
  "guest_email_subject_template",
  "internal_email_subject_template",
  "reservation_notification_email",
] as const;

const adminSettingKeys = [
  "app_name",
  "audit_log_retention_days",
  "imprint_url",
  "privacy_contact_email",
  "privacy_notice_text",
  "privacy_policy_url",
  "public_site_url",
  "reservation_retention_days",
  ...settingKeys,
  ...emailTemplateSettingKeys,
] as const;

function normalizeBoolean(value: string | undefined, fallback: boolean) {
  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return fallback;
}

function normalizePositiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeOptionalString(value: string | undefined, fallback?: string) {
  return value || fallback || undefined;
}

export function normalizeHolidayState(country: string, state: string) {
  if (country.toUpperCase() === "DE" && state.toUpperCase() === "NRW") {
    return "NW";
  }

  return state.toUpperCase();
}

export async function getBusinessSettings(): Promise<BusinessSettings> {
  const rows = await db
    .select({ key: appSettings.key, value: appSettings.value })
    .from(appSettings)
    .where(inArray(appSettings.key, [...settingKeys]));

  const settings = new Map(rows.map((row) => [row.key, row.value]));
  const holidayCountry = settings.get("holiday_country") ?? env.HOLIDAY_COUNTRY;

  return {
    blockSundays: normalizeBoolean(settings.get("block_sundays"), env.BLOCK_SUNDAYS),
    earliestReservationTime:
      settings.get("earliest_reservation_time") ?? env.EARLIEST_RESERVATION_TIME,
    holidayCountry,
    holidayState: normalizeHolidayState(
      holidayCountry,
      settings.get("holiday_state") ?? env.HOLIDAY_STATE,
    ),
    latestReservationTime: settings.get("latest_reservation_time") ?? env.LATEST_RESERVATION_TIME,
    maxGuestsPerRequest: normalizePositiveInteger(
      settings.get("max_guests_per_request"),
      env.MAX_GUESTS_PER_REQUEST,
    ),
  };
}

export async function getEmailTemplateSettings(): Promise<EmailTemplateSettings> {
  const rows = await db
    .select({ key: appSettings.key, value: appSettings.value })
    .from(appSettings)
    .where(inArray(appSettings.key, [...emailTemplateSettingKeys]));

  const settings = new Map(rows.map((row) => [row.key, row.value]));

  return {
    guestEmailSubjectTemplate:
      settings.get("guest_email_subject_template") ?? env.GUEST_EMAIL_SUBJECT_TEMPLATE,
    internalEmailSubjectTemplate:
      settings.get("internal_email_subject_template") ?? env.INTERNAL_EMAIL_SUBJECT_TEMPLATE,
    reservationNotificationEmail:
      settings.get("reservation_notification_email") ?? env.RESERVATION_NOTIFICATION_EMAIL,
  };
}

export async function getAdminSettings(): Promise<AdminSettings> {
  const rows = await db
    .select({ key: appSettings.key, value: appSettings.value })
    .from(appSettings)
    .where(inArray(appSettings.key, [...adminSettingKeys]));

  const settings = new Map(rows.map((row) => [row.key, row.value]));
  const businessSettings = await getBusinessSettings();
  const emailSettings = await getEmailTemplateSettings();

  return {
    ...businessSettings,
    ...emailSettings,
    appName: settings.get("app_name") ?? env.APP_NAME,
    auditLogRetentionDays: normalizePositiveInteger(
      settings.get("audit_log_retention_days"),
      env.AUDIT_LOG_RETENTION_DAYS,
    ),
    imprintUrl: normalizeOptionalString(settings.get("imprint_url"), env.IMPRINT_URL),
    privacyContactEmail: normalizeOptionalString(
      settings.get("privacy_contact_email"),
      env.PRIVACY_CONTACT_EMAIL,
    ),
    privacyNoticeText: settings.get("privacy_notice_text") ?? env.PRIVACY_NOTICE_TEXT,
    privacyPolicyUrl: normalizeOptionalString(
      settings.get("privacy_policy_url"),
      env.PRIVACY_POLICY_URL,
    ),
    publicSiteUrl: settings.get("public_site_url") ?? env.NEXT_PUBLIC_SITE_URL,
    reservationRetentionDays: normalizePositiveInteger(
      settings.get("reservation_retention_days"),
      env.RESERVATION_RETENTION_DAYS,
    ),
  };
}

export async function updateOpeningHours(input: OpeningHoursInput, session: AuthenticatedSession) {
  await db.transaction(async (tx) => {
    await tx
      .insert(appSettings)
      .values([
        {
          key: "earliest_reservation_time",
          value: input.earliestReservationTime,
          isSecret: false,
          updatedByUserId: session.userId,
        },
        {
          key: "latest_reservation_time",
          value: input.latestReservationTime,
          isSecret: false,
          updatedByUserId: session.userId,
        },
      ])
      .onConflictDoUpdate({
        target: appSettings.key,
        set: {
          updatedByUserId: session.userId,
          updatedAt: new Date(),
          value: sql<string>`excluded.value`,
        },
      });

    await tx.insert(auditLog).values({
      userId: session.userId,
      action: "opening_hours.update",
      entityType: "app_settings",
      entityId: "opening_hours",
      metadata: {
        earliestReservationTime: input.earliestReservationTime,
        latestReservationTime: input.latestReservationTime,
      },
    });
  });
}

export async function updateAdminSettings(
  input: AdminSettingsInput,
  session: AuthenticatedSession,
) {
  const rows = [
    ["app_name", input.appName],
    ["audit_log_retention_days", String(input.auditLogRetentionDays)],
    ["block_sundays", String(input.blockSundays)],
    ["earliest_reservation_time", input.earliestReservationTime],
    ["guest_email_subject_template", input.guestEmailSubjectTemplate],
    ["holiday_country", input.holidayCountry],
    ["holiday_state", normalizeHolidayState(input.holidayCountry, input.holidayState)],
    ["imprint_url", input.imprintUrl ?? ""],
    ["internal_email_subject_template", input.internalEmailSubjectTemplate],
    ["latest_reservation_time", input.latestReservationTime],
    ["max_guests_per_request", String(input.maxGuestsPerRequest)],
    ["privacy_contact_email", input.privacyContactEmail ?? ""],
    ["privacy_notice_text", input.privacyNoticeText],
    ["privacy_policy_url", input.privacyPolicyUrl ?? ""],
    ["public_site_url", input.publicSiteUrl],
    ["reservation_notification_email", input.reservationNotificationEmail],
    ["reservation_retention_days", String(input.reservationRetentionDays)],
  ] as const;

  await db.transaction(async (tx) => {
    await tx
      .insert(appSettings)
      .values(
        rows.map(([key, value]) => ({
          key,
          value,
          isSecret: false,
          updatedByUserId: session.userId,
        })),
      )
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
      action: "settings.update",
      entityType: "app_settings",
      entityId: "general",
      metadata: {
        keys: rows.map(([key]) => key),
      },
    });
  });
}
