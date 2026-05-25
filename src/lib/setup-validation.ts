import { z } from "zod";

export const setupAdminSchema = z
  .object({
    setupToken: z.string().min(1, "Setup-Token ist erforderlich."),
    name: z.string().trim().min(2, "Name ist erforderlich.").max(160),
    email: z
      .string()
      .email("Bitte eine gültige E-Mail-Adresse eingeben.")
      .max(320)
      .transform((value) => value.toLowerCase()),
    password: z.string().min(12, "Das Passwort muss mindestens 12 Zeichen lang sein.").max(200),
    passwordConfirm: z.string().min(1, "Passwortbestätigung ist erforderlich."),
  })
  .refine((data) => data.password === data.passwordConfirm, {
    message: "Die Passwörter stimmen nicht überein.",
    path: ["passwordConfirm"],
  });

export type SetupAdminInput = z.infer<typeof setupAdminSchema>;
