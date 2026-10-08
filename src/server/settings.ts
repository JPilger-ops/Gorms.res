import { and, eq, inArray, sql } from "drizzle-orm";
import { appSettings, auditLog, venueSettings } from "@/db/schema";
import { defaultEnv, env as deploymentEnv } from "@/src/lib/env";
import { HEIDEKOENIG_VENUE_ID, reservationRetentionDays } from "@/src/lib/venue-defaults.mjs";
import type { VenueContext } from "@/src/server/venues";
import type { OpeningHoursInput } from "@/src/lib/opening-hours-validation";
import type { AdminSettingsInput } from "@/src/lib/settings-validation";
import type { SmtpSettingsInput } from "@/src/lib/smtp-validation";
import { db } from "@/src/server/db";
import { decryptSecret, encryptSecret } from "@/src/server/encryption";
import type { AuthenticatedSession } from "@/src/server/guards";

export type BusinessSettings = {
  blockMondays: boolean;
  blockPublicHolidays: boolean;
  blockSundays: boolean;
  blockTuesdays: boolean;
  earliestReservationTime: string;
  holidayCountry: string;
  holidayState: string;
  indoorCapacity: number;
  latestReservationBufferMinutes: number;
  latestReservationTime: string;
  manualReviewGuestThreshold: number;
  maxGuestsPerRequest: number;
  reservationSlotMinutes: number;
  standardOccupancyMinutes: number;
  summerKitchenAcceptanceUntil: string;
  summerSeasonEnd: string;
  summerSeasonStart: string;
  winterKitchenAcceptanceUntil: string;
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

export type SmtpSettings = {
  fromAddress?: string;
  fromName: string;
  host: string;
  password?: string;
  passwordSet: boolean;
  passwordSource: "database" | "environment" | "missing";
  port: number;
  user?: string;
};

export type SmtpSettingsForUi = Omit<SmtpSettings, "password">;

function getVenueDefaults(venue: VenueContext) {
  if (venue.id === HEIDEKOENIG_VENUE_ID) return deploymentEnv;
  return {
    ...defaultEnv,
    APP_NAME: venue.name,
    SMTP_FROM_NAME: venue.name,
    RESERVATION_NOTIFICATION_EMAIL: "",
    NEXT_PUBLIC_SITE_URL: "",
    GUEST_EMAIL_SUBJECT_TEMPLATE: `Ihre Reservierungsanfrage bei ${venue.name}`,
    AUDIT_LOG_RETENTION_DAYS: deploymentEnv.AUDIT_LOG_RETENTION_DAYS,
  };
}

export async function getVenueSettingMap(venue: VenueContext, keys: readonly string[]) {
  const rows = await db
    .select({ key: venueSettings.key, value: venueSettings.value })
    .from(venueSettings)
    .where(and(eq(venueSettings.venueId, venue.id), inArray(venueSettings.key, [...keys])));
  return new Map(rows.map((row) => [row.key, row.value]));
}

const settingKeys = [
  "block_mondays",
  "block_public_holidays",
  "block_sundays",
  "block_tuesdays",
  "earliest_reservation_time",
  "holiday_country",
  "holiday_state",
  "indoor_capacity",
  "latest_reservation_buffer_minutes",
  "latest_reservation_time",
  "manual_review_guest_threshold",
  "max_guests_per_request",
  "reservation_slot_minutes",
  "standard_occupancy_minutes",
  "summer_kitchen_acceptance_until",
  "summer_season_end",
  "summer_season_start",
  "winter_kitchen_acceptance_until",
] as const;

const emailTemplateSettingKeys = [
  "guest_email_subject_template",
  "internal_email_subject_template",
  "reservation_notification_email",
] as const;

const adminSettingKeys = [
  "app_name",
  "imprint_url",
  "privacy_contact_email",
  "privacy_notice_text",
  "privacy_policy_url",
  "public_site_url",
  "reservation_retention_days",
  ...settingKeys,
  ...emailTemplateSettingKeys,
] as const;

const smtpSettingKeys = [
  "smtp_from_address",
  "smtp_from_name",
  "smtp_host",
  "smtp_password",
  "smtp_port",
  "smtp_user",
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

function normalizePort(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= 65535 ? parsed : fallback;
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

export type ReservationSeason = "summer" | "winter";

export function timeToMinutesStrict(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

export function minutesToTime(minutes: number) {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, minutes));
  const hours = Math.floor(clamped / 60);
  const remainder = clamped % 60;

  return `${String(hours).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

export function getSeasonForDate(date: string, settings: BusinessSettings): ReservationSeason {
  const monthDay = date.slice(5, 10);
  const start = settings.summerSeasonStart;
  const end = settings.summerSeasonEnd;

  if (start <= end) {
    return monthDay >= start && monthDay <= end ? "summer" : "winter";
  }

  return monthDay >= start || monthDay <= end ? "summer" : "winter";
}

export function getLatestReservationTimeForSeason(
  settings: BusinessSettings,
  season: ReservationSeason,
) {
  const kitchenAcceptanceUntil =
    season === "summer"
      ? settings.summerKitchenAcceptanceUntil
      : settings.winterKitchenAcceptanceUntil;

  return minutesToTime(
    timeToMinutesStrict(kitchenAcceptanceUntil) - settings.latestReservationBufferMinutes,
  );
}

export function getLatestReservationTimeForDate(date: string, settings: BusinessSettings) {
  const seasonalLatest = getLatestReservationTimeForSeason(
    settings,
    getSeasonForDate(date, settings),
  );
  const configuredLatest = settings.latestReservationTime;

  return timeToMinutesStrict(configuredLatest) < timeToMinutesStrict(seasonalLatest)
    ? configuredLatest
    : seasonalLatest;
}

export async function getBusinessSettings(venue: VenueContext): Promise<BusinessSettings> {
  const env = getVenueDefaults(venue);
  const settings = await getVenueSettingMap(venue, settingKeys);
  const holidayCountry = settings.get("holiday_country") ?? env.HOLIDAY_COUNTRY;
  const latestReservationBufferMinutes = normalizePositiveInteger(
    settings.get("latest_reservation_buffer_minutes"),
    env.LATEST_RESERVATION_BUFFER_MINUTES,
  );
  const summerKitchenAcceptanceUntil =
    settings.get("summer_kitchen_acceptance_until") ?? env.SUMMER_KITCHEN_ACCEPTANCE_UNTIL;

  return {
    blockMondays: normalizeBoolean(settings.get("block_mondays"), env.BLOCK_MONDAYS),
    blockPublicHolidays: normalizeBoolean(
      settings.get("block_public_holidays"),
      env.BLOCK_PUBLIC_HOLIDAYS,
    ),
    blockSundays: normalizeBoolean(settings.get("block_sundays"), env.BLOCK_SUNDAYS),
    blockTuesdays: normalizeBoolean(settings.get("block_tuesdays"), env.BLOCK_TUESDAYS),
    earliestReservationTime:
      settings.get("earliest_reservation_time") ?? env.EARLIEST_RESERVATION_TIME,
    holidayCountry,
    holidayState: normalizeHolidayState(
      holidayCountry,
      settings.get("holiday_state") ?? env.HOLIDAY_STATE,
    ),
    indoorCapacity: normalizePositiveInteger(settings.get("indoor_capacity"), env.INDOOR_CAPACITY),
    latestReservationBufferMinutes,
    latestReservationTime:
      settings.get("latest_reservation_time") ??
      minutesToTime(
        timeToMinutesStrict(summerKitchenAcceptanceUntil) - latestReservationBufferMinutes,
      ),
    manualReviewGuestThreshold: normalizePositiveInteger(
      settings.get("manual_review_guest_threshold"),
      env.MANUAL_REVIEW_GUEST_THRESHOLD,
    ),
    maxGuestsPerRequest: normalizePositiveInteger(
      settings.get("max_guests_per_request"),
      env.MAX_GUESTS_PER_REQUEST,
    ),
    reservationSlotMinutes: normalizePositiveInteger(
      settings.get("reservation_slot_minutes"),
      env.RESERVATION_SLOT_MINUTES,
    ),
    standardOccupancyMinutes: normalizePositiveInteger(
      settings.get("standard_occupancy_minutes"),
      env.STANDARD_OCCUPANCY_MINUTES,
    ),
    summerKitchenAcceptanceUntil,
    summerSeasonEnd: settings.get("summer_season_end") ?? env.SUMMER_SEASON_END,
    summerSeasonStart: settings.get("summer_season_start") ?? env.SUMMER_SEASON_START,
    winterKitchenAcceptanceUntil:
      settings.get("winter_kitchen_acceptance_until") ?? env.WINTER_KITCHEN_ACCEPTANCE_UNTIL,
  };
}

export async function getEmailTemplateSettings(
  venue: VenueContext,
): Promise<EmailTemplateSettings> {
  const env = getVenueDefaults(venue);
  const settings = await getVenueSettingMap(venue, emailTemplateSettingKeys);

  return {
    guestEmailSubjectTemplate:
      settings.get("guest_email_subject_template") ?? env.GUEST_EMAIL_SUBJECT_TEMPLATE,
    internalEmailSubjectTemplate:
      settings.get("internal_email_subject_template") ?? env.INTERNAL_EMAIL_SUBJECT_TEMPLATE,
    reservationNotificationEmail:
      settings.get("reservation_notification_email") ?? env.RESERVATION_NOTIFICATION_EMAIL,
  };
}

export async function getAdminSettings(venue: VenueContext): Promise<AdminSettings> {
  const env = getVenueDefaults(venue);
  const settings = await getVenueSettingMap(venue, adminSettingKeys);
  const businessSettings = await getBusinessSettings(venue);
  const emailSettings = await getEmailTemplateSettings(venue);
  const auditRetention = await db.query.appSettings.findFirst({
    where: eq(appSettings.key, "audit_log_retention_days"),
  });

  return {
    ...businessSettings,
    ...emailSettings,
    appName: settings.get("app_name") ?? env.APP_NAME,
    auditLogRetentionDays: normalizePositiveInteger(
      auditRetention?.value,
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
    reservationRetentionDays: reservationRetentionDays(
      venue.id,
      settings.get("reservation_retention_days"),
      deploymentEnv.RESERVATION_RETENTION_DAYS,
    ),
  };
}

async function getSmtpSettingMap(venue: VenueContext) {
  return getVenueSettingMap(venue, smtpSettingKeys);
}

export async function getSmtpSettings(venue: VenueContext): Promise<SmtpSettings> {
  const env = getVenueDefaults(venue);
  const settings = await getSmtpSettingMap(venue);
  const encryptedPassword = settings.get("smtp_password");
  const password = encryptedPassword ? decryptSecret(encryptedPassword) : env.SMTP_PASSWORD;
  const passwordSource = encryptedPassword
    ? "database"
    : env.SMTP_PASSWORD
      ? "environment"
      : "missing";

  return {
    fromAddress: settings.get("smtp_from_address") || env.SMTP_FROM_ADDRESS,
    fromName: settings.get("smtp_from_name") ?? env.SMTP_FROM_NAME,
    host: settings.get("smtp_host") ?? env.SMTP_HOST,
    password,
    passwordSet: Boolean(password),
    passwordSource,
    port: normalizePort(settings.get("smtp_port"), env.SMTP_PORT),
    user: settings.get("smtp_user") || env.SMTP_USER,
  };
}

export async function getSmtpSettingsForUi(venue: VenueContext): Promise<SmtpSettingsForUi> {
  const env = getVenueDefaults(venue);
  const settings = await getSmtpSettingMap(venue);
  const encryptedPassword = settings.get("smtp_password");
  const passwordSource = encryptedPassword
    ? "database"
    : env.SMTP_PASSWORD
      ? "environment"
      : "missing";

  return {
    fromAddress: settings.get("smtp_from_address") || env.SMTP_FROM_ADDRESS,
    fromName: settings.get("smtp_from_name") ?? env.SMTP_FROM_NAME,
    host: settings.get("smtp_host") ?? env.SMTP_HOST,
    passwordSet: Boolean(encryptedPassword || env.SMTP_PASSWORD),
    passwordSource,
    port: normalizePort(settings.get("smtp_port"), env.SMTP_PORT),
    user: settings.get("smtp_user") || env.SMTP_USER,
  };
}

export async function updateOpeningHours(
  venue: VenueContext,
  input: OpeningHoursInput,
  session: AuthenticatedSession,
) {
  await db.transaction(async (tx) => {
    await tx
      .insert(venueSettings)
      .values([
        {
          venueId: venue.id,
          key: "earliest_reservation_time",
          value: input.earliestReservationTime,
          isSecret: false,
          updatedByUserId: session.userId,
        },
        {
          venueId: venue.id,
          key: "latest_reservation_time",
          value: input.latestReservationTime,
          isSecret: false,
          updatedByUserId: session.userId,
        },
      ])
      .onConflictDoUpdate({
        target: [venueSettings.venueId, venueSettings.key],
        set: {
          updatedByUserId: session.userId,
          updatedAt: new Date(),
          value: sql<string>`excluded.value`,
        },
      });

    await tx.insert(auditLog).values({
      userId: session.userId,
      action: "opening_hours.update",
      venueId: venue.id,
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
  venue: VenueContext,
  input: AdminSettingsInput,
  session: AuthenticatedSession,
) {
  const rows = [
    ["app_name", input.appName],
    ["block_mondays", String(input.blockMondays)],
    ["block_public_holidays", String(input.blockPublicHolidays)],
    ["block_sundays", String(input.blockSundays)],
    ["block_tuesdays", String(input.blockTuesdays)],
    ["earliest_reservation_time", input.earliestReservationTime],
    ["guest_email_subject_template", input.guestEmailSubjectTemplate],
    ["holiday_country", input.holidayCountry],
    ["holiday_state", normalizeHolidayState(input.holidayCountry, input.holidayState)],
    ["indoor_capacity", String(input.indoorCapacity)],
    ["imprint_url", input.imprintUrl ?? ""],
    ["internal_email_subject_template", input.internalEmailSubjectTemplate],
    ["latest_reservation_buffer_minutes", String(input.latestReservationBufferMinutes)],
    ["latest_reservation_time", input.latestReservationTime],
    ["manual_review_guest_threshold", String(input.manualReviewGuestThreshold)],
    ["max_guests_per_request", String(input.maxGuestsPerRequest)],
    ["privacy_contact_email", input.privacyContactEmail ?? ""],
    ["privacy_notice_text", input.privacyNoticeText],
    ["privacy_policy_url", input.privacyPolicyUrl ?? ""],
    ["public_site_url", input.publicSiteUrl],
    ["reservation_notification_email", input.reservationNotificationEmail],
    ["reservation_slot_minutes", String(input.reservationSlotMinutes)],
    ["reservation_retention_days", String(input.reservationRetentionDays)],
    ["standard_occupancy_minutes", String(input.standardOccupancyMinutes)],
    ["summer_kitchen_acceptance_until", input.summerKitchenAcceptanceUntil],
    ["summer_season_end", input.summerSeasonEnd],
    ["summer_season_start", input.summerSeasonStart],
    ["winter_kitchen_acceptance_until", input.winterKitchenAcceptanceUntil],
  ] as const;

  await db.transaction(async (tx) => {
    await tx
      .insert(venueSettings)
      .values(
        rows.map(([key, value]) => ({
          venueId: venue.id,
          key,
          value,
          isSecret: false,
          updatedByUserId: session.userId,
        })),
      )
      .onConflictDoUpdate({
        target: [venueSettings.venueId, venueSettings.key],
        set: {
          isSecret: false,
          updatedByUserId: session.userId,
          updatedAt: new Date(),
          value: sql<string>`excluded.value`,
        },
      });

    await tx
      .insert(appSettings)
      .values({
        key: "audit_log_retention_days",
        value: String(input.auditLogRetentionDays),
        updatedByUserId: session.userId,
      })
      .onConflictDoUpdate({
        target: appSettings.key,
        set: {
          value: String(input.auditLogRetentionDays),
          updatedByUserId: session.userId,
          updatedAt: new Date(),
        },
      });

    await tx.insert(auditLog).values({
      userId: session.userId,
      action: "settings.update",
      venueId: venue.id,
      entityType: "app_settings",
      entityId: "general",
      metadata: {
        keys: rows.map(([key]) => key),
      },
    });
  });
}

export async function updateSmtpSettings(
  venue: VenueContext,
  input: SmtpSettingsInput,
  session: AuthenticatedSession,
) {
  const rows = [
    ["smtp_from_address", input.smtpFromAddress, false],
    ["smtp_from_name", input.smtpFromName, false],
    ["smtp_host", input.smtpHost, false],
    ["smtp_port", String(input.smtpPort), false],
    ["smtp_user", input.smtpUser, false],
  ] as const;

  const secretRows = input.smtpPassword
    ? ([["smtp_password", encryptSecret(input.smtpPassword), true]] as const)
    : [];

  await db.transaction(async (tx) => {
    await tx
      .insert(venueSettings)
      .values(
        [...rows, ...secretRows].map(([key, value, isSecret]) => ({
          venueId: venue.id,
          key,
          value,
          isSecret,
          updatedByUserId: session.userId,
        })),
      )
      .onConflictDoUpdate({
        target: [venueSettings.venueId, venueSettings.key],
        set: {
          isSecret: sql<boolean>`excluded.is_secret`,
          updatedByUserId: session.userId,
          updatedAt: new Date(),
          value: sql<string>`excluded.value`,
        },
      });

    await tx.insert(auditLog).values({
      userId: session.userId,
      action: "smtp_settings.update",
      venueId: venue.id,
      entityType: "app_settings",
      entityId: "smtp",
      metadata: {
        passwordReplaced: Boolean(input.smtpPassword),
      },
    });
  });
}
