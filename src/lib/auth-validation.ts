import { z } from "zod";

export const loginSchema = z.object({
  email: z
    .string()
    .email("Bitte eine gültige E-Mail-Adresse eingeben.")
    .max(320)
    .transform((value) => value.toLowerCase()),
  password: z.string().min(1, "Passwort ist erforderlich.").max(200),
});

export type LoginInput = z.infer<typeof loginSchema>;
