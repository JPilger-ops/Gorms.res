"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  reservationDecisionSchema,
  reservationDecisionTypes,
} from "@/src/lib/reservation-decision-validation";
import { generateReservationDecisionAiDraft } from "@/src/server/ai/reservation-drafts";
import { requirePermission } from "@/src/server/guards";
import { sendReservationDecision } from "@/src/server/reservation-decisions";

export type ReservationDecisionActionState = {
  fieldErrors?: Record<string, string[]>;
  message?: string;
  success?: boolean;
};

export type ReservationAiDraftActionState = {
  draft?: {
    body: string;
    riskNotes: string[];
    subject: string;
  };
  fieldErrors?: Record<string, string[]>;
  message?: string;
  success?: boolean;
};

const aiDraftActionSchema = z.object({
  decision: z.enum(reservationDecisionTypes),
  expectedStatus: z.literal("pending"),
  id: z.string().uuid("Ungültige Anfrage-ID."),
});

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

  if (result.ok) {
    redirect(`/admin/reservations/${parsed.data.id}?decision=${parsed.data.decision}`);
  }

  return {
    message: result.message,
    success: result.ok,
  };
}

export async function generateReservationAiDraftAction(
  _previousState: ReservationAiDraftActionState,
  formData: FormData,
): Promise<ReservationAiDraftActionState> {
  const session = await requirePermission("reservations:respond");
  const parsed = aiDraftActionSchema.safeParse({
    decision: formData.get("decision"),
    expectedStatus: formData.get("expectedStatus"),
    id: formData.get("id"),
  });

  if (!parsed.success) {
    return {
      fieldErrors: parsed.error.flatten().fieldErrors,
      message: "KI-Vorlage konnte nicht vorbereitet werden.",
    };
  }

  const result = await generateReservationDecisionAiDraft({
    decision: parsed.data.decision,
    id: parsed.data.id,
    session,
  });

  if (!result.ok) {
    return {
      message: result.message,
      success: false,
    };
  }

  return {
    draft: result.draft,
    message: "KI-Vorlage wurde eingefügt. Bitte vor dem Senden sorgfältig prüfen und bearbeiten.",
    success: true,
  };
}
