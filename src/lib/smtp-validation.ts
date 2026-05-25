import { z } from "zod";

const emptyStringToUndefined = (value: unknown) => (value === "" ? undefined : value);

export const smtpSettingsSchema = z.object({
  smtpFromAddress: z.string().email("Bitte eine gültige Absenderadresse eingeben.").max(320),
  smtpFromName: z.string().trim().min(2, "Absendername ist erforderlich.").max(160),
  smtpHost: z.string().trim().min(2, "SMTP Host ist erforderlich.").max(240),
  smtpPassword: z.preprocess(emptyStringToUndefined, z.string().min(1).max(500).optional()),
  smtpPort: z.coerce.number().int("Bitte einen gültigen Port eingeben.").min(1).max(65535),
  smtpUser: z.string().trim().min(1, "SMTP User ist erforderlich.").max(320),
});

export const smtpTestSchema = z.object({
  testEmail: z.string().email("Bitte eine gültige Test-E-Mail-Adresse eingeben.").max(320),
});

export type SmtpSettingsInput = z.infer<typeof smtpSettingsSchema>;
export type SmtpTestInput = z.infer<typeof smtpTestSchema>;
