"use client";

import { useMemo, useState } from "react";
import {
  ReservationDecisionForm,
  type ReservationDecisionDraft,
} from "@/app/admin/reservations/[id]/decision-form";
import type { ReservationDecisionType } from "@/src/lib/reservation-decision-validation";
import type { ReservationStatus } from "@/src/server/reservations";

const decisionLabels: Record<ReservationDecisionType, string> = {
  accept: "Zusage",
  decline: "Absage",
  question: "Rückfrage",
};

const decisionSummaries: Record<ReservationDecisionType, string> = {
  accept: "Persönlich bestätigen und Status auf angenommen setzen.",
  decline: "Persönlich absagen und Status auf abgelehnt setzen.",
  question: "Rückfrage senden, Status bleibt offen.",
};

export function ReservationDecisionWorkspace({
  aiEnabled,
  aiMessage,
  drafts,
  expectedStatus,
  reservationId,
}: {
  aiEnabled: boolean;
  aiMessage: string;
  drafts: ReservationDecisionDraft[];
  expectedStatus: ReservationStatus;
  reservationId: string;
}) {
  const [selectedDecision, setSelectedDecision] = useState<ReservationDecisionType>(
    drafts[0]?.decision ?? "accept",
  );
  const selectedDraft = useMemo(
    () => drafts.find((draft) => draft.decision === selectedDecision) ?? drafts[0],
    [drafts, selectedDecision],
  );

  if (!selectedDraft) {
    return null;
  }

  return (
    <div className="admin-decision-workspace">
      <div className="admin-decision-switch" role="tablist" aria-label="Antwortart auswählen">
        {drafts.map((draft) => {
          const active = draft.decision === selectedDecision;

          return (
            <button
              aria-selected={active}
              className="admin-decision-switch-item"
              data-active={active ? "true" : undefined}
              key={draft.decision}
              onClick={() => setSelectedDecision(draft.decision)}
              role="tab"
              type="button"
            >
              <span>{decisionLabels[draft.decision]}</span>
              <small>{decisionSummaries[draft.decision]}</small>
            </button>
          );
        })}
      </div>

      <ReservationDecisionForm
        aiEnabled={aiEnabled}
        aiMessage={aiMessage}
        draft={selectedDraft}
        expectedStatus={expectedStatus}
        key={selectedDraft.decision}
        reservationId={reservationId}
      />
    </div>
  );
}
