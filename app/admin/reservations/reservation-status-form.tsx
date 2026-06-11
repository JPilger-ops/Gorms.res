"use client";

import { useActionState } from "react";
import {
  updateReservationStatusAction,
  type ReservationStatusActionState,
} from "@/app/admin/reservations/actions";
import type { ReservationStatus } from "@/src/server/reservations";
import { FormFeedback } from "@/components/ui/form-feedback";

const initialState: ReservationStatusActionState = {};

const statusLabels: Record<ReservationStatus, string> = {
  accepted: "Angenommen",
  cancelled: "Storniert",
  declined: "Abgelehnt",
  pending: "Offen",
};

const statusItems: ReservationStatus[] = ["pending", "accepted", "declined", "cancelled"];

export function ReservationStatusForm({ id, status }: { id: string; status: ReservationStatus }) {
  const [state, formAction, pending] = useActionState(updateReservationStatusAction, initialState);

  return (
    <form action={formAction} className="mt-4 rounded-2xl border border-border bg-surface/65 p-4">
      <input name="id" type="hidden" value={id} />
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <label className="grid gap-2 text-sm font-semibold">
          Status bearbeiten
          <select className="field-input" defaultValue={status} name="status">
            {statusItems.map((item) => (
              <option key={item} value={item}>
                {statusLabels[item]}
              </option>
            ))}
          </select>
        </label>
        <button
          aria-busy={pending}
          className="primary-action px-5 py-3"
          disabled={pending}
          type="submit"
        >
          {pending ? "Status wird gespeichert..." : "Status speichern"}
        </button>
      </div>
      <p className="mt-3 text-sm leading-6 text-muted">
        Diese Änderung erzeugt nur einen internen Status und Audit-Log-Eintrag. Gäste erhalten
        dadurch keine automatische Zusage oder Absage.
      </p>
      <div className="mt-3">
        <FormFeedback state={state} />
      </div>
    </form>
  );
}
