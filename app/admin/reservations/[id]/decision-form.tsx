"use client";

import { useActionState } from "react";
import {
  generateReservationAiDraftAction,
  sendReservationDecisionAction,
  type ReservationAiDraftActionState,
  type ReservationDecisionActionState,
} from "@/app/admin/reservations/[id]/actions";
import { FieldError, FormFeedback } from "@/components/ui/form-feedback";
import type { ReservationDecisionType } from "@/src/lib/reservation-decision-validation";
import type { ReservationStatus } from "@/src/server/reservations";

const initialState: ReservationDecisionActionState = {};
const initialAiDraftState: ReservationAiDraftActionState = {};

const decisionLabels: Record<ReservationDecisionType, string> = {
  accept: "Zusage senden",
  decline: "Absage senden",
  question: "Rückfrage senden",
};

const decisionDescriptions: Record<ReservationDecisionType, string> = {
  accept:
    "Sendet eine verbindliche persönliche Zusage an den Gast und setzt den Status auf angenommen.",
  decline: "Sendet eine persönliche Absage an den Gast und setzt den Status auf abgelehnt.",
  question: "Sendet eine Rückfrage an den Gast. Der Status bleibt offen.",
};

const decisionEyebrows: Record<ReservationDecisionType, string> = {
  accept: "Zusage",
  decline: "Absage",
  question: "Rückfrage",
};

const manualSendLabels: Record<ReservationDecisionType, string> = {
  accept: "Geprüfte Zusage jetzt senden",
  decline: "Geprüfte Absage jetzt senden",
  question: "Geprüfte Rückfrage jetzt senden",
};

export type ReservationDecisionDraft = {
  body: string;
  decision: ReservationDecisionType;
  subject: string;
};

export function ReservationDecisionForm({
  aiEnabled,
  aiMessage,
  draft,
  expectedStatus,
  reservationId,
}: {
  aiEnabled: boolean;
  aiMessage: string;
  draft: ReservationDecisionDraft;
  expectedStatus: ReservationStatus;
  reservationId: string;
}) {
  const [state, formAction, pending] = useActionState(sendReservationDecisionAction, initialState);
  const [aiState, aiFormAction, aiPending] = useActionState(
    generateReservationAiDraftAction,
    initialAiDraftState,
  );
  const currentSubject = aiState.draft?.subject ?? draft.subject;
  const currentBody = aiState.draft?.body ?? draft.body;

  return (
    <form action={formAction} className="admin-decision-card" data-decision={draft.decision}>
      <input name="decision" type="hidden" value={draft.decision} />
      <input name="expectedStatus" type="hidden" value={expectedStatus} />
      <input name="id" type="hidden" value={reservationId} />

      <div className="flex flex-col gap-2">
        <p className="eyebrow">{decisionEyebrows[draft.decision]}</p>
        <h4 className="text-xl font-semibold">{decisionLabels[draft.decision]}</h4>
        <p className="text-sm leading-6 text-muted">{decisionDescriptions[draft.decision]}</p>
      </div>

      <div className="mt-4 space-y-4">
        <label className="block space-y-2">
          <span className="text-sm font-semibold">Betreff</span>
          <input
            className="glass-control min-h-12 w-full px-4 outline-none"
            defaultValue={currentSubject}
            key={currentSubject}
            name="subject"
            required
            type="text"
          />
          <FieldError messages={state.fieldErrors?.subject} />
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-semibold">E-Mail-Text</span>
          <textarea
            className="glass-control min-h-56 w-full resize-y px-4 py-3 outline-none"
            defaultValue={currentBody}
            key={currentBody}
            name="body"
            required
          />
          <FieldError messages={state.fieldErrors?.body} />
        </label>

        <div className="admin-decision-note">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-bold">KI-Vorlage</p>
              <p className="mt-1 text-sm leading-6 text-muted">
                {aiMessage} Fügt nur Text in Betreff und E-Mail-Text ein und versendet nie
                automatisch.
              </p>
            </div>
            <span className="w-fit rounded-full border border-border bg-surface/80 px-3 py-1 text-xs font-bold uppercase text-warning">
              Kein Versand
            </span>
          </div>
          <button
            aria-busy={aiPending}
            className="secondary-action mt-3 w-full"
            disabled={!aiEnabled || aiPending || pending}
            formAction={aiFormAction}
            type="submit"
          >
            {aiPending
              ? "KI-Vorlage wird erstellt..."
              : aiEnabled
                ? "KI-Vorlage in Felder einfügen"
                : "KI-Entwürfe nicht freigegeben"}
          </button>
          <FormFeedback state={aiState} />
          {aiState.draft?.riskNotes.length ? (
            <div className="mt-3 rounded-2xl border border-border bg-surface/70 p-3">
              <p className="text-xs font-bold uppercase text-muted">KI-Prüfhinweise</p>
              <ul className="mt-2 space-y-1 text-sm leading-6">
                {aiState.draft.riskNotes.map((note) => (
                  <li className="flex gap-2" key={note}>
                    <span className="mt-2 size-1.5 shrink-0 rounded-full bg-warning" />
                    <span>{note}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <div className="admin-decision-note">
          <p className="text-sm font-bold">Manueller Versand</p>
          <p className="mt-1 text-sm leading-6 text-muted">
            Erst dieser Button sendet die E-Mail. Bei Zusage oder Absage wird danach der Status
            geändert.
          </p>
        </div>

        <button
          aria-busy={pending}
          className="primary-action w-full"
          disabled={pending}
          type="submit"
        >
          {pending ? "Wird gesendet..." : manualSendLabels[draft.decision]}
        </button>

        <FormFeedback state={state} />
      </div>
    </form>
  );
}
