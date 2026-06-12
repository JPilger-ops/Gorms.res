import { z } from "zod";
import { isTime, timeToMinutes } from "@/src/lib/dates";
import { validateEmailSubjectTemplate } from "@/src/server/email-templates";

const emptyStringToUndefined = (value: unknown) => (value === "" ? undefined : value);
const monthDayPattern = /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

function emailTemplateSchema(label: string) {
  return z
    .string()
    .trim()
    .min(1, `${label} ist erforderlich.`)
    .max(240, `${label} ist zu lang.`)
    .refine((value) => validateEmailSubjectTemplate(value).valid, {
      message: "Das Template enthält nicht unterstützte Variablen.",
    });
}

export const adminSettingsSchema = z
  .object({
    appName: z.string().trim().min(2, "App-Name ist erforderlich.").max(120),
    auditLogRetentionDays: z.coerce.number().int("Bitte eine ganze Zahl eingeben.").min(1).max(730),
    blockMondays: z.boolean(),
    blockPublicHolidays: z.boolean(),
    blockSundays: z.boolean(),
    blockTuesdays: z.boolean(),
    earliestReservationTime: z.string().refine(isTime, "Bitte eine gültige Startzeit eingeben."),
    guestEmailSubjectTemplate: emailTemplateSchema("Gast-Betreff"),
    holidayCountry: z
      .string()
      .trim()
      .min(2)
      .max(3)
      .transform((value) => value.toUpperCase()),
    holidayState: z
      .string()
      .trim()
      .min(2)
      .max(8)
      .transform((value) => value.toUpperCase()),
    indoorCapacity: z.coerce.number().int("Bitte eine ganze Zahl eingeben.").min(1).max(1000),
    latestReservationBufferMinutes: z.coerce
      .number()
      .int("Bitte eine ganze Zahl eingeben.")
      .min(0)
      .max(360),
    imprintUrl: z.preprocess(emptyStringToUndefined, z.string().url().max(500).optional()),
    internalEmailSubjectTemplate: emailTemplateSchema("Interner Betreff"),
    latestReservationTime: z.string().refine(isTime, "Bitte eine gültige Endzeit eingeben."),
    manualReviewGuestThreshold: z.coerce
      .number()
      .int("Bitte eine ganze Zahl eingeben.")
      .min(1)
      .max(1000),
    maxGuestsPerRequest: z.coerce.number().int("Bitte eine ganze Zahl eingeben.").min(1).max(500),
    privacyContactEmail: z.preprocess(
      emptyStringToUndefined,
      z.string().email().max(320).optional(),
    ),
    privacyNoticeText: z.string().trim().min(20).max(3000),
    privacyPolicyUrl: z.preprocess(emptyStringToUndefined, z.string().url().max(500).optional()),
    publicSiteUrl: z.string().url("Bitte eine gültige öffentliche URL eingeben.").max(500),
    reservationNotificationEmail: z
      .string()
      .email("Bitte eine gültige Empfängeradresse eingeben.")
      .max(320),
    reservationSlotMinutes: z.coerce
      .number()
      .int("Bitte eine ganze Zahl eingeben.")
      .min(5)
      .max(240),
    reservationRetentionDays: z.coerce
      .number()
      .int("Bitte eine ganze Zahl eingeben.")
      .min(1)
      .max(365),
    standardOccupancyMinutes: z.coerce
      .number()
      .int("Bitte eine ganze Zahl eingeben.")
      .min(15)
      .max(720),
    summerKitchenAcceptanceUntil: z
      .string()
      .refine(isTime, "Bitte eine gültige Küchenzeit eingeben."),
    summerSeasonEnd: z
      .string()
      .regex(monthDayPattern, "Bitte im Format MM-TT eingeben, z.B. 10-31."),
    summerSeasonStart: z
      .string()
      .regex(monthDayPattern, "Bitte im Format MM-TT eingeben, z.B. 04-01."),
    winterKitchenAcceptanceUntil: z
      .string()
      .refine(isTime, "Bitte eine gültige Küchenzeit eingeben."),
  })
  .refine(
    (value) => {
      const earliest = timeToMinutes(value.earliestReservationTime);
      const latest = timeToMinutes(value.latestReservationTime);

      return earliest !== null && latest !== null && earliest < latest;
    },
    {
      message: "Die Startzeit muss vor der Endzeit liegen.",
      path: ["latestReservationTime"],
    },
  )
  .refine(
    (value) => {
      const earliest = timeToMinutes(value.earliestReservationTime);
      const summerKitchen = timeToMinutes(value.summerKitchenAcceptanceUntil);
      const latestSummer =
        summerKitchen === null ? null : summerKitchen - value.latestReservationBufferMinutes;

      return earliest !== null && latestSummer !== null && earliest <= latestSummer;
    },
    {
      message: "Sommer-Küchenannahme minus Puffer muss nach der Startzeit liegen.",
      path: ["summerKitchenAcceptanceUntil"],
    },
  )
  .refine(
    (value) => {
      const earliest = timeToMinutes(value.earliestReservationTime);
      const winterKitchen = timeToMinutes(value.winterKitchenAcceptanceUntil);
      const latestWinter =
        winterKitchen === null ? null : winterKitchen - value.latestReservationBufferMinutes;

      return earliest !== null && latestWinter !== null && earliest <= latestWinter;
    },
    {
      message: "Winter-Küchenannahme minus Puffer muss nach der Startzeit liegen.",
      path: ["winterKitchenAcceptanceUntil"],
    },
  )
  .refine((value) => value.manualReviewGuestThreshold <= value.maxGuestsPerRequest, {
    message: "Die Review-Schwelle darf nicht über der maximalen Personenanzahl liegen.",
    path: ["manualReviewGuestThreshold"],
  });

export type AdminSettingsInput = z.infer<typeof adminSettingsSchema>;
