import { auditLog } from "@/db/schema";
import type { ReservationDecisionType } from "@/src/lib/reservation-decision-validation";
import { generateAiDraft } from "@/src/server/ai/ollama-client";
import type { AiDraftTask } from "@/src/server/ai/schemas";
import { db } from "@/src/server/db";
import type { AuthenticatedSession } from "@/src/server/guards";
import { getAdminReservationDetail } from "@/src/server/reservation-detail";

const decisionTaskMap: Record<ReservationDecisionType, AiDraftTask> = {
  accept: "acceptance",
  decline: "decline",
  question: "question",
};

export type ReservationAiDraftResult =
  | {
      draft: {
        body: string;
        riskNotes: string[];
        subject: string;
      };
      ok: true;
    }
  | {
      message: string;
      ok: false;
    };

function buildAvailabilityNotes(
  availabilityCheck: NonNullable<
    Awaited<ReturnType<typeof getAdminReservationDetail>>
  >["availabilityCheck"],
) {
  if (!availabilityCheck) {
    return [];
  }

  return [
    ...availabilityCheck.reasons,
    ...availabilityCheck.warnings,
    ...availabilityCheck.manualReviewReasons,
  ].slice(0, 20);
}

function getAiFailureMessage(reason: string) {
  if (reason === "disabled") {
    return "KI ist deaktiviert.";
  }

  if (reason === "timeout") {
    return "Der lokale KI-Dienst hat nicht rechtzeitig geantwortet.";
  }

  if (reason === "invalid_output") {
    return "Die KI-Antwort hatte kein gültiges Vorlagenformat.";
  }

  return "KI-Vorlage konnte nicht erstellt werden.";
}

export async function generateReservationDecisionAiDraft({
  decision,
  id,
  session,
}: {
  decision: ReservationDecisionType;
  id: string;
  session: AuthenticatedSession;
}): Promise<ReservationAiDraftResult> {
  const detail = await getAdminReservationDetail(id);

  if (!detail) {
    return {
      message: "Reservierungsanfrage wurde nicht gefunden.",
      ok: false,
    };
  }

  if (detail.reservation.status !== "pending") {
    return {
      message: "KI-Vorlagen sind nur für offene Anfragen verfügbar.",
      ok: false,
    };
  }

  const result = await generateAiDraft({
    reservation: {
      availabilityNotes: buildAvailabilityNotes(detail.availabilityCheck),
      guestCount: detail.reservation.guestCount,
      guestMessage: detail.reservation.message ?? undefined,
      requestedDate: detail.reservation.requestedDate,
      requestedTime: detail.reservation.requestedTime,
    },
    task: decisionTaskMap[decision],
  });

  if (!result.ok) {
    return {
      message: getAiFailureMessage(result.reason),
      ok: false,
    };
  }

  await db.insert(auditLog).values({
    action: "reservation.ai_draft_generated",
    entityId: id,
    entityType: "reservation_request",
    metadata: {
      decision,
      riskNoteCount: result.draft.riskNotes.length,
    },
    userId: session.userId,
  });

  return {
    draft: {
      body: result.draft.body,
      riskNotes: result.draft.riskNotes,
      subject: result.draft.title,
    },
    ok: true,
  };
}
