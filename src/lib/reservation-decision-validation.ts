import { z } from "zod";

const reservationDecisionStatusValues = ["pending", "accepted", "declined", "cancelled"] as const;
export const reservationDecisionTypes = ["accept", "decline", "question"] as const;

export type ReservationDecisionType = (typeof reservationDecisionTypes)[number];

export const reservationDecisionSchema = z.object({
  body: z.string().trim().min(20, "Bitte einen E-Mail-Text eingeben.").max(5000),
  decision: z.enum(reservationDecisionTypes),
  expectedStatus: z.enum(reservationDecisionStatusValues),
  id: z.string().uuid("Ungültige Anfrage-ID."),
  subject: z.string().trim().min(3, "Bitte einen Betreff eingeben.").max(240),
});

export type ReservationDecisionInput = z.infer<typeof reservationDecisionSchema>;
