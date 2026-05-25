import { inArray, sql } from "drizzle-orm";
import { appSettings, auditLog } from "@/db/schema";
import { env } from "@/src/lib/env";
import type { OpeningHoursInput } from "@/src/lib/opening-hours-validation";
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
