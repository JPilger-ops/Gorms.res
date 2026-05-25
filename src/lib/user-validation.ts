import { z } from "zod";
import { roles } from "@/src/lib/permissions";

const baseUserSchema = {
  email: z
    .string()
    .email("Bitte eine gültige E-Mail-Adresse eingeben.")
    .max(320)
    .transform((value) => value.toLowerCase()),
  name: z.string().trim().min(2, "Name ist erforderlich.").max(160),
  role: z.enum(roles, {
    error: "Bitte eine gültige Rolle auswählen.",
  }),
};

const passwordFields = {
  password: z.string().min(12, "Das Passwort muss mindestens 12 Zeichen lang sein.").max(200),
  passwordConfirm: z.string().min(1, "Passwortbestätigung ist erforderlich."),
};

export const createUserSchema = z
  .object({
    ...baseUserSchema,
    ...passwordFields,
  })
  .refine((data) => data.password === data.passwordConfirm, {
    message: "Die Passwörter stimmen nicht überein.",
    path: ["passwordConfirm"],
  });

export const updateUserSchema = z.object({
  ...baseUserSchema,
  id: z.string().uuid("Ungültige Benutzer-ID."),
  isActive: z.boolean(),
});

export const resetUserPasswordSchema = z
  .object({
    id: z.string().uuid("Ungültige Benutzer-ID."),
    ...passwordFields,
  })
  .refine((data) => data.password === data.passwordConfirm, {
    message: "Die Passwörter stimmen nicht überein.",
    path: ["passwordConfirm"],
  });

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type ResetUserPasswordInput = z.infer<typeof resetUserPasswordSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
