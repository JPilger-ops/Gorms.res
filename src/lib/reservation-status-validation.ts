import { z } from "zod";
import { reservationStatuses } from "@/src/server/reservations";

export const updateReservationStatusSchema = z.object({
  id: z.string().uuid("Ungültige Reservierungsanfrage."),
  reason: z
    .string()
    .trim()
    .min(10, "Bitte eine kurze Begründung mit mindestens 10 Zeichen angeben.")
    .max(500, "Die Begründung darf maximal 500 Zeichen lang sein."),
  status: z.enum(reservationStatuses, {
    error: "Bitte einen gültigen Status auswählen.",
  }),
});

export type UpdateReservationStatusInput = z.infer<typeof updateReservationStatusSchema>;
