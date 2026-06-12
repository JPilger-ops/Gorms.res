import { z } from "zod";
import { isIsoDate } from "@/src/lib/dates";

const emptyStringToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

export const createReservationEventSchema = z.object({
  date: z.string().refine(isIsoDate, "Bitte ein gültiges Datum auswählen."),
  publicNote: z.preprocess(
    emptyStringToUndefined,
    z
      .string()
      .trim()
      .max(240, "Der öffentliche Hinweis darf maximal 240 Zeichen lang sein.")
      .optional(),
  ),
  reservationsAllowed: z.coerce.boolean().default(false),
  title: z.string().trim().min(2, "Bitte einen Titel eingeben.").max(160),
});

export const deleteReservationEventSchema = z.object({
  id: z.string().uuid("Ungültiger Eventtag."),
});

export type CreateReservationEventInput = z.infer<typeof createReservationEventSchema>;
