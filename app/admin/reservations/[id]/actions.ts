"use server";

import { revalidatePath } from "next/cache";
import { reservationDecisionSchema } from "@/src/lib/reservation-decision-validation";
import { requirePermission } from "@/src/server/guards";
import { sendReservationDecision } from "@/src/server/reservation-decisions";

export type ReservationDecisionActionState = {
  fieldErrors?: Record<string, string[]>;
  message?: string;
  success?: boolean;
};

export async function sendReservationDecisionAction(
  _previousState: ReservationDecisionActionState,
  formData: FormData,
): Promise<ReservationDecisionActionState> {
  const session = await requirePermission("reservations:respond");
  const parsed = reservationDecisionSchema.safeParse({
    body: formData.get("body"),
    decision: formData.get("decision"),
    expectedStatus: formData.get("expectedStatus"),
    id: formData.get("id"),
    subject: formData.get("subject"),
  });

  if (!parsed.success) {
    return {
      fieldErrors: parsed.error.flatten().fieldErrors,
      message: "Bitte Eingaben prüfen.",
    };
  }

  const result = await sendReservationDecision(parsed.data, session);

  revalidatePath(`/admin/reservations/${parsed.data.id}`);
  revalidatePath("/admin/reservations");
  revalidatePath("/admin");

  return {
    message: result.message,
    success: result.ok,
  };
}
