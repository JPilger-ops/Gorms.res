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
import { buildReservationDecisionDraft } from "@/src/server/reservation-decisions";
import { getAdminReservationDetail } from "@/src/server/reservation-detail";

const decisionTaskMap: Record<ReservationDecisionType, AiDraftTask> = {
  accept: "acceptance_note",
  decline: "decline_note",
  question: "question_text",
};

const blockingIssueMessages: Record<AiDraftContentBlockingIssue, string> = {
  acceptance_pending_phrase: "falscher Hinweis zur Verbindlichkeit in einer Zusage erkannt",
  ascii_umlaut: "ASCII-Ersatz statt deutscher Umlaute erkannt",
  body_too_long: "Text ist zu lang",
  email_address: "mögliche erfundene E-Mail-Adresse erkannt",
  guarantee_phrase: "garantierte Tisch- oder Verfügbarkeitszusage erkannt",
  guest_request_copied: "Gastformulierung wurde ungeprüft kopiert",
  phone_number: "mögliche erfundene Telefonnummer erkannt",
  placeholder: "möglicher Platzhalter erkannt",
  price_amount: "konkreter Betrag oder Preis erkannt",
  question_wrong_flow: "fachlich falsche Rückfrageformulierung erkannt",
  specific_place_reserved: "bestimmter Tisch oder Platz wurde als reserviert dargestellt",
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
      message: string;
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

async function buildStandardTemplateResult({
  decision,
  detail,
  message,
  session,
}: {
  decision: ReservationDecisionType;
  detail: NonNullable<Awaited<ReturnType<typeof getAdminReservationDetail>>>;
  message: string;
  session: AuthenticatedSession;
}): Promise<ReservationAiDraftResult> {
  const draft = buildReservationDecisionDraft(decision, detail.reservation);

  await db.insert(auditLog).values({
    action: "reservation.ai_draft_fallback",
    entityId: detail.reservation.id,
    entityType: "reservation_request",
    metadata: {
      decision,
      reason: message,
    },
    userId: session.userId,
  });

  return {
    draft: {
      body: draft.body,
      riskNotes: [message],
      subject: draft.subject,
    },
    message,
    ok: true,
  };
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
    return await buildStandardTemplateResult({
      decision,
      detail,
      message: `${getAiFailureMessage(result.reason)} Das sichere Gorms.res-Standardtemplate wurde eingefügt.`,
      session,
    });
  }

  const aiTask = decisionTaskMap[decision];
  const validation = validateAiDraftContent(result.draft, aiTask);

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
  const finalDraft = buildReservationDecisionDraft(
    decision,
    detail.reservation,
    result.draft.content,
  );
  const successMessage = result.draft.content
    ? "KI-Baustein wurde in das sichere Gorms.res-Template eingefügt. Bitte vor dem Senden prüfen."
    : "KI hatte keinen zusätzlichen Hinweis. Das sichere Gorms.res-Standardtemplate wurde eingefügt.";

  await db.insert(auditLog).values({
    action: "reservation.ai_draft_generated",
    entityId: id,
    entityType: "reservation_request",
    metadata: {
      decision,
      contentEmpty: result.draft.content.length === 0,
      riskNoteCount: riskNotes.length,
      warningCount: validation.warnings.length,
      warnings: validation.warnings,
    },
    userId: session.userId,
  });

  return {
    draft: {
      body: finalDraft.body,
      riskNotes,
      subject: finalDraft.subject,
    },
    message: successMessage,
    ok: true,
  };
}
