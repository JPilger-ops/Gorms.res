import { z } from "zod";
import { isIsoDate } from "@/src/lib/dates";

export const createBlockedDaySchema = z.object({
  date: z.string().refine(isIsoDate, "Bitte ein gültiges Datum auswählen."),
  reason: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().max(240, "Die Begründung darf maximal 240 Zeichen lang sein.").optional(),
  ),
});

export const deleteBlockedDaySchema = z.object({
  id: z.string().uuid("Ungültiger Sperrtag."),
});

export type CreateBlockedDayInput = z.infer<typeof createBlockedDaySchema>;
