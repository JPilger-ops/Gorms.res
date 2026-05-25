import { z } from "zod";
import { isIsoDate, isTime } from "@/src/lib/dates";

export const reservationRequestSchema = z.object({
  date: z.string().refine(isIsoDate, "Bitte ein gültiges Datum auswählen."),
  email: z
    .string()
    .email("Bitte eine gültige E-Mail-Adresse eingeben.")
    .max(320)
    .transform((value) => value.toLowerCase()),
  guestCount: z.coerce
    .number()
    .int("Bitte eine ganze Personenanzahl eingeben.")
    .min(1, "Bitte mindestens eine Person angeben."),
  guestName: z.string().trim().min(2, "Bitte einen Namen eingeben.").max(160),
  message: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().max(1000).optional(),
  ),
  phone: z.string().trim().min(3, "Bitte eine Telefonnummer eingeben.").max(80),
  privacyAccepted: z.literal("true", {
    error: "Bitte den Datenschutzhinweis bestätigen.",
  }),
  time: z.string().refine(isTime, "Bitte eine gültige Uhrzeit auswählen."),
  website: z
    .string()
    .max(0)
    .optional()
    .transform(() => undefined),
});

export type ReservationRequestInput = z.infer<typeof reservationRequestSchema>;
