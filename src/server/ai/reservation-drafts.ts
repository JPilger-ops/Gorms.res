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
import {
  buildSpecialRequestContentForDecision,
  DEPOSIT_REQUIRED_AMOUNT_EUR,
  evaluateSpecialRequests,
  type SpecialRequestEvaluation,
} from "@/src/server/reservation-special-requests";

const decisionTaskMap: Record<ReservationDecisionType, AiDraftTask> = {
  accept: "acceptance_note",
  decline: "decline_note",
  question: "question_text",
};

const blockingIssueMessages: Record<AiDraftContentBlockingIssue, string> = {
  acceptance_pending_phrase: "falscher Hinweis zur Verbindlichkeit in einer Zusage erkannt",
  ascii_umlaut: "ASCII-Ersatz statt deutscher Umlaute erkannt",
  body_too_long: "Text ist zu lang",
  deposit_policy_violation: "falsche Aussage zur Anzahlung erkannt",
  email_address: "mögliche erfundene E-Mail-Adresse erkannt",
  guarantee_phrase: "garantierte Tisch- oder Verfügbarkeitszusage erkannt",
  guest_request_copied: "Gastformulierung wurde ungeprüft kopiert",
  phone_number: "mögliche erfundene Telefonnummer erkannt",
  placeholder: "möglicher Platzhalter erkannt",
  price_amount: "konkreter Betrag oder Preis erkannt",
  question_wrong_flow: "fachlich falsche Rückfrageformulierung erkannt",
  special_request_forbidden_claim: "unzulässige Aussage zu einem Sonderwunsch erkannt",
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

function getAllowedPriceAmounts(guestCount: number) {
  return guestCount >= 30 ? [DEPOSIT_REQUIRED_AMOUNT_EUR] : [];
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

function preservesRequiredPolicyFacts(baseContent: string, candidateContent: string) {
  const requiredPatterns = [
    /100\s*€/,
    /innenbereich/i,
    /vor ort zusätzlich/i,
    /a-\s*und\s*b-tische/i,
    /nicht verbindlich/i,
  ];

  return requiredPatterns.every(
    (pattern) => !pattern.test(baseContent) || pattern.test(candidateContent),
  );
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

async function buildRuleBasedTemplateResult({
  content,
  decision,
  detail,
  specialRequestEvaluation,
  session,
}: {
  content: string;
  decision: ReservationDecisionType;
  detail: NonNullable<Awaited<ReturnType<typeof getAdminReservationDetail>>>;
  specialRequestEvaluation: SpecialRequestEvaluation;
  session: AuthenticatedSession;
}): Promise<ReservationAiDraftResult> {
  const aiTask = decisionTaskMap[decision];
  const validation = validateAiDraftContent({ content }, aiTask, {
    allowedPriceAmounts: getAllowedPriceAmounts(detail.reservation.guestCount),
  });

  if (!validation.ok) {
    await db.insert(auditLog).values({
      action: "reservation.policy_draft_rejected",
      entityId: detail.reservation.id,
      entityType: "reservation_request",
      metadata: {
        decision,
        blockingIssueCount: validation.blockingIssues.length,
        blockingIssues: validation.blockingIssues,
      },
      userId: session.userId,
    });

    return {
      message: formatBlockingIssueMessage(validation.blockingIssues),
      ok: false,
    };
  }

  const baseValidationWarnings = validation.warnings.map((warning) => warningMessages[warning]);
  const baseRiskNotes = [
    "Sonderwunsch-Baustein wurde aus festen Gorms.res-Regeln erstellt.",
    ...baseValidationWarnings,
  ].slice(0, 10);
  const polishResult = await generateAiDraft({
    reservation: {
      availabilityNotes: [
        ...buildAvailabilityNotes(detail.availabilityCheck),
        ...specialRequestEvaluation.policyNotes,
      ].slice(0, 20),
      baseContent: content,
      guestCount: detail.reservation.guestCount,
      guestMessage: detail.reservation.message ?? undefined,
      requestedDate: detail.reservation.requestedDate,
      requestedTime: detail.reservation.requestedTime,
      specialRequests: specialRequestEvaluation.structuredPolicies,
    },
    task: "policy_polish",
  });

  if (polishResult.ok && polishResult.draft.content) {
    const polishValidation = validateAiDraftContent(polishResult.draft, aiTask, {
      allowedPriceAmounts: getAllowedPriceAmounts(detail.reservation.guestCount),
    });
    const requiredFactsPreserved = preservesRequiredPolicyFacts(
      content,
      polishResult.draft.content,
    );

    if (polishValidation.ok && requiredFactsPreserved) {
      const polishValidationWarnings = polishValidation.warnings.map(
        (warning) => warningMessages[warning],
      );
      const polishedDraft = buildReservationDecisionDraft(
        decision,
        detail.reservation,
        polishResult.draft.content,
      );
      const riskNotes = [
        ...baseRiskNotes,
        "KI hat den Baustein nur sprachlich geglättet.",
        ...polishResult.draft.riskNotes,
        ...polishValidationWarnings,
      ].slice(0, 10);

      await db.insert(auditLog).values({
        action: "reservation.policy_draft_polished",
        entityId: detail.reservation.id,
        entityType: "reservation_request",
        metadata: {
          decision,
          warningCount: polishValidation.warnings.length,
          warnings: polishValidation.warnings,
        },
        userId: session.userId,
      });

      return {
        draft: {
          body: polishedDraft.body,
          riskNotes,
          subject: polishedDraft.subject,
        },
        message:
          "KI hat den sicheren Gorms.res-Regelbaustein sprachlich geglättet. Bitte vor dem Senden prüfen.",
        ok: true,
      };
    }

    await db.insert(auditLog).values({
      action: "reservation.policy_polish_rejected",
      entityId: detail.reservation.id,
      entityType: "reservation_request",
      metadata: {
        decision,
        blockingIssueCount: polishValidation.blockingIssues.length,
        blockingIssues: polishValidation.blockingIssues,
        requiredFactsPreserved,
        warningCount: polishValidation.warnings.length,
        warnings: polishValidation.warnings,
      },
      userId: session.userId,
    });
  }

  const draft = buildReservationDecisionDraft(decision, detail.reservation, content);
  const riskNotes = [
    ...baseRiskNotes,
    polishResult.ok
      ? "KI konnte den Regelbaustein nicht sicher verbessern. Sicherer Gorms.res-Baustein wurde eingefügt."
      : `${getAiFailureMessage(polishResult.reason)} Sicherer Gorms.res-Baustein wurde eingefügt.`,
  ].slice(0, 10);

  await db.insert(auditLog).values({
    action: "reservation.policy_draft_generated",
    entityId: detail.reservation.id,
    entityType: "reservation_request",
    metadata: {
      decision,
      warningCount: validation.warnings.length,
      warnings: validation.warnings,
    },
    userId: session.userId,
  });

  return {
    draft: {
      body: draft.body,
      riskNotes,
      subject: draft.subject,
    },
    message:
      "KI konnte den Regelbaustein nicht verbessern. Sicherer Gorms.res-Baustein wurde eingefügt.",
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

  const specialRequestEvaluation = evaluateSpecialRequests({
    guestCount: detail.reservation.guestCount,
    message: detail.reservation.message,
  });
  const ruleBasedContent = buildSpecialRequestContentForDecision(
    decision,
    specialRequestEvaluation,
  );

  if (ruleBasedContent) {
    return await buildRuleBasedTemplateResult({
      content: ruleBasedContent,
      decision,
      detail,
      specialRequestEvaluation,
      session,
    });
  }

  if (decision === "question" && specialRequestEvaluation.hasSpecialRequest) {
    return await buildStandardTemplateResult({
      decision,
      detail,
      message:
        "Für die erkannten Sonderwünsche ist keine automatische Rückfrage nötig. Das sichere Gorms.res-Standardtemplate wurde eingefügt.",
      session,
    });
  }

  const result = await generateAiDraft({
    reservation: {
      availabilityNotes: [
        ...buildAvailabilityNotes(detail.availabilityCheck),
        ...specialRequestEvaluation.policyNotes,
      ].slice(0, 20),
      guestCount: detail.reservation.guestCount,
      guestMessage: detail.reservation.message ?? undefined,
      requestedDate: detail.reservation.requestedDate,
      requestedTime: detail.reservation.requestedTime,
      specialRequests: specialRequestEvaluation.structuredPolicies,
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
  const validation = validateAiDraftContent(result.draft, aiTask, {
    allowedPriceAmounts: getAllowedPriceAmounts(detail.reservation.guestCount),
  });

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
