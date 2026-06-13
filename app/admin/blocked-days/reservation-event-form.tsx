"use client";

import { useActionState } from "react";
import {
  createReservationEventAction,
  type BlockedDayActionState,
} from "@/app/admin/blocked-days/actions";
import { FieldError, FormFeedback } from "@/components/ui/form-feedback";

const initialState: BlockedDayActionState = {};

export function ReservationEventForm() {
  const [state, formAction, pending] = useActionState(createReservationEventAction, initialState);

  return (
    <form action={formAction} className="glass-panel admin-panel space-y-4 p-5 sm:p-6">
      <div>
        <p className="eyebrow">Musik / Events</p>
        <h3 className="mt-2 text-2xl font-semibold">Eventtag eintragen</h3>
        <p className="mt-2 text-sm leading-6 text-muted">
          Standardmäßig blockiert ein Eventtag normale Reservierungsanfragen.
        </p>
      </div>

      <FormFeedback state={state} />

      <label className="block space-y-2">
        <span className="text-sm font-semibold">Datum</span>
        <input
          className="glass-control min-h-12 w-full px-4 outline-none"
          name="date"
          type="date"
          required
        />
        <FieldError messages={state.fieldErrors?.date} />
      </label>

      <label className="block space-y-2">
        <span className="text-sm font-semibold">Titel</span>
        <input
          className="glass-control min-h-12 w-full px-4 outline-none"
          name="title"
          type="text"
          maxLength={160}
          placeholder="Musikabend"
          required
        />
        <FieldError messages={state.fieldErrors?.title} />
      </label>

      <label className="block space-y-2">
        <span className="text-sm font-semibold">Öffentlicher Hinweis optional</span>
        <textarea
          className="glass-control min-h-28 w-full resize-y px-4 py-3 outline-none"
          name="publicNote"
          maxLength={240}
          placeholder="An diesem Tag sind keine normalen Reservierungsanfragen möglich."
        />
        <FieldError messages={state.fieldErrors?.publicNote} />
      </label>

      <label className="admin-toggle-card items-start">
        <input className="mt-1 size-4 accent-primary" name="reservationsAllowed" type="checkbox" />
        <span>
          <span className="block text-sm font-semibold">
            Normale Reservierungsanfragen erlauben
          </span>
          <span className="mt-1 block text-sm leading-6 text-muted">
            Nur aktivieren, wenn der Eventtag öffentliche Anfragen nicht blockieren soll.
          </span>
        </span>
      </label>

      <button
        className="primary-action w-full"
        disabled={pending}
        aria-busy={pending}
        type="submit"
      >
        {pending ? "Wird gespeichert..." : "Eventtag speichern"}
      </button>
    </form>
  );
}
