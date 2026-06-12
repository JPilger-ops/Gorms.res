"use client";

import { useActionState } from "react";
import {
  sendReservationDecisionAction,
  type ReservationDecisionActionState,
} from "@/app/admin/reservations/[id]/actions";
import { FieldError, FormFeedback } from "@/components/ui/form-feedback";
import type { ReservationDecisionType } from "@/src/lib/reservation-decision-validation";
import type { ReservationStatus } from "@/src/server/reservations";

const initialState: ReservationDecisionActionState = {};

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

export type ReservationDecisionDraft = {
  body: string;
  decision: ReservationDecisionType;
  subject: string;
};

export function ReservationDecisionForm({
  draft,
  expectedStatus,
  reservationId,
}: {
  draft: ReservationDecisionDraft;
  expectedStatus: ReservationStatus;
  reservationId: string;
}) {
  const [state, formAction, pending] = useActionState(sendReservationDecisionAction, initialState);

  return (
    <form action={formAction} className="rounded-3xl border border-border bg-surface/65 p-4">
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
            defaultValue={draft.subject}
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
            defaultValue={draft.body}
            name="body"
            required
          />
          <FieldError messages={state.fieldErrors?.body} />
        </label>

        <button
          aria-busy={pending}
          className="primary-action w-full"
          disabled={pending}
          type="submit"
        >
          {pending ? "Wird gesendet..." : decisionLabels[draft.decision]}
        </button>

        <FormFeedback state={state} />
      </div>
    </form>
  );
}
