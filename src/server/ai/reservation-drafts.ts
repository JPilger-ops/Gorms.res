import { auditLog } from "@/db/schema";
import type { ReservationDecisionType } from "@/src/lib/reservation-decision-validation";
import {
  validateAiDraftContent,
  type AiDraftContentBlockingIssue,
  type AiDraftContentWarning,
} from "@/src/server/ai/content-validation";
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

const blockingIssueMessages: Record<AiDraftContentBlockingIssue, string> = {
  body_too_long: "Text ist zu lang",
  email_address: "mögliche erfundene E-Mail-Adresse erkannt",
  guarantee_phrase: "garantierte Tisch- oder Verfügbarkeitszusage erkannt",
  phone_number: "mögliche erfundene Telefonnummer erkannt",
  placeholder: "möglicher Platzhalter erkannt",
  price_amount: "konkreter Betrag oder Preis erkannt",
  signature_placeholder: "kaputter Template- oder Signaturhinweis erkannt",
  subject_in_body: "Betreffzeile im E-Mail-Text erkannt",
};

const warningMessages: Record<AiDraftContentWarning, string> = {
  availability_cautious: "Hinweis: vorsichtige Formulierung zur Verfügbarkeit prüfen.",
  deposit_notice: "Hinweis: allgemeine Anzahlung erwähnt. Bitte fachlich prüfen.",
  opening_hours:
    "Hinweis: Öffnungszeiten erwähnt. Bitte mit den aktuellen Einstellungen abgleichen.",
  special_requests: "Hinweis: Sonderwünsche erwähnt. Bitte vor dem Versand prüfen.",
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

function formatBlockingIssueMessage(issues: AiDraftContentBlockingIssue[]) {
  const labels = issues.map((issue) => blockingIssueMessages[issue]);

  return `KI-Entwurf wurde nicht übernommen: ${labels.join(", ")}.`;
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

  const validation = validateAiDraftContent(result.draft);

  if (!validation.ok) {
    await db.insert(auditLog).values({
      action: "reservation.ai_draft_rejected",
      entityId: id,
      entityType: "reservation_request",
      metadata: {
        decision,
        blockingIssueCount: validation.blockingIssues.length,
        blockingIssues: validation.blockingIssues,
        warningCount: validation.warnings.length,
        warnings: validation.warnings,
      },
      userId: session.userId,
    });

    return {
      message: formatBlockingIssueMessage(validation.blockingIssues),
      ok: false,
    };
  }

  const validationWarnings = validation.warnings.map((warning) => warningMessages[warning]);
  const riskNotes = [...result.draft.riskNotes, ...validationWarnings].slice(0, 10);

  await db.insert(auditLog).values({
    action: "reservation.ai_draft_generated",
    entityId: id,
    entityType: "reservation_request",
    metadata: {
      decision,
      riskNoteCount: riskNotes.length,
      warningCount: validation.warnings.length,
      warnings: validation.warnings,
    },
    userId: session.userId,
  });

  return {
    draft: {
      body: result.draft.body,
      riskNotes,
      subject: result.draft.title,
    },
    ok: true,
  };
}
