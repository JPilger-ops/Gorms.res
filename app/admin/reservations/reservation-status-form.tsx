"use client";

import { useActionState } from "react";
import {
  updateReservationStatusAction,
  type ReservationStatusActionState,
} from "@/app/admin/reservations/actions";
import type { ReservationStatus } from "@/src/server/reservations";
import { FieldError, FormFeedback } from "@/components/ui/form-feedback";

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
    <details className="admin-disclosure mt-4">
      <summary>Manuellen Status als Sonderfall setzen</summary>
      <form action={formAction} className="mt-4 space-y-4">
        <input name="id" type="hidden" value={id} />
        <div className="rounded-3xl border border-warning/25 bg-warning/10 p-4 text-sm leading-6 text-foreground">
          <p className="font-semibold">Sonderfall ohne Gast-Mail</p>
          <p className="mt-1 text-muted">
            Diese Statusänderung sendet keine E-Mail an den Gast und erzeugt keine interne
            Bestätigungs-ICS. Nutze sie nur, wenn der normale Zusage-, Absage- oder
            Rückfrage-Workflow nicht passt.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
          <label className="grid gap-2 text-sm font-semibold">
            Neuer interner Status
            <select className="field-input" defaultValue={status} name="status">
              {statusItems.map((item) => (
                <option key={item} value={item}>
                  {statusLabels[item]}
                </option>
              ))}
            </select>
            <FieldError messages={state.fieldErrors?.status} />
          </label>
          <button
            aria-busy={pending}
            className="secondary-action px-5 py-3"
            disabled={pending}
            type="submit"
          >
            {pending ? "Speichert..." : "Status speichern"}
          </button>
        </div>
        <label className="grid gap-2 text-sm font-semibold">
          Begründung für Audit-Log
          <textarea
            className="field-input min-h-28 resize-y"
            maxLength={500}
            name="reason"
            placeholder="z. B. telefonische Rückmeldung wurde bereits separat geklärt"
            required
          />
          <span className="text-xs font-medium leading-5 text-muted">
            Keine unnötigen Kontaktdaten oder vollständigen Nachrichten eintragen.
          </span>
          <FieldError messages={state.fieldErrors?.reason} />
        </label>
        <FormFeedback state={state} />
      </form>
    </details>
  );
}
