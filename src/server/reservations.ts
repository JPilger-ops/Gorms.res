import { reservationRequests } from "@/db/schema";
import type { ReservationRequestInput } from "@/src/lib/reservation-validation";
import { db } from "@/src/server/db";
import { validateReservationRules } from "@/src/server/reservation-rules";

export type CreateReservationResult =
  | {
      ok: true;
      id: string;
      emailData: ReservationRequestInput & { id: string };
    }
  | {
      ok: false;
      reasons: string[];
    };

export async function createReservationRequest(
  input: ReservationRequestInput,
): Promise<CreateReservationResult> {
  const ruleResult = await validateReservationRules({
    date: input.date,
    guestCount: input.guestCount,
    time: input.time,
  });

  if (!ruleResult.allowed) {
    return {
      ok: false,
      reasons: ruleResult.reasons,
    };
  }

  const [reservation] = await db
    .insert(reservationRequests)
    .values({
      requestedDate: input.date,
      requestedTime: input.time,
      guestName: input.guestName,
      guestEmail: input.email,
      guestPhone: input.phone,
      guestCount: input.guestCount,
      message: input.message,
      status: "pending",
      privacyAcknowledgedAt: new Date(),
    })
    .returning({ id: reservationRequests.id });

  return {
    ok: true,
    id: reservation.id,
    emailData: {
      ...input,
      id: reservation.id,
    },
  };
}
