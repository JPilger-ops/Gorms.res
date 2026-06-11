import { z } from "zod";
import { reservationStatuses } from "@/src/server/reservations";

export const updateReservationStatusSchema = z.object({
  id: z.string().uuid("Ungültige Reservierungsanfrage."),
  status: z.enum(reservationStatuses, {
    error: "Bitte einen gültigen Status auswählen.",
  }),
});

export type UpdateReservationStatusInput = z.infer<typeof updateReservationStatusSchema>;
