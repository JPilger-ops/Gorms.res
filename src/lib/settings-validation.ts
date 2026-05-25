import { z } from "zod";
import { isTime, timeToMinutes } from "@/src/lib/dates";
import { validateEmailSubjectTemplate } from "@/src/server/email-templates";

const emptyStringToUndefined = (value: unknown) => (value === "" ? undefined : value);

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
    blockSundays: z.boolean(),
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
    imprintUrl: z.preprocess(emptyStringToUndefined, z.string().url().max(500).optional()),
    internalEmailSubjectTemplate: emailTemplateSchema("Interner Betreff"),
    latestReservationTime: z.string().refine(isTime, "Bitte eine gültige Endzeit eingeben."),
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
    reservationRetentionDays: z.coerce
      .number()
      .int("Bitte eine ganze Zahl eingeben.")
      .min(1)
      .max(365),
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
  );

export type AdminSettingsInput = z.infer<typeof adminSettingsSchema>;
