"use client";

import { useActionState } from "react";
import {
  updateOpeningHoursAction,
  type OpeningHoursActionState,
} from "@/app/admin/opening-hours/actions";
import { FieldError, FormFeedback } from "@/components/ui/form-feedback";

const initialState: OpeningHoursActionState = {};

export function OpeningHoursForm({
  earliestReservationTime,
  latestReservationTime,
}: {
  earliestReservationTime: string;
  latestReservationTime: string;
}) {
  const [state, formAction, pending] = useActionState(updateOpeningHoursAction, initialState);

  return (
    <form action={formAction} className="glass-panel admin-panel space-y-4 p-5 sm:p-6">
      <div>
        <p className="eyebrow">Zeitraum</p>
        <h3 className="mt-2 text-2xl font-semibold">Reservierungszeiten</h3>
        <p className="mt-2 text-sm leading-6 text-muted">
          Diese Zeiten begrenzen neue Reservierungsanfragen im öffentlichen Formular.
        </p>
      </div>

      <FormFeedback state={state} />

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-2">
          <span className="text-sm font-semibold">Früheste Uhrzeit</span>
          <input
            className="glass-control min-h-12 w-full px-4 outline-none"
            defaultValue={earliestReservationTime}
            name="earliestReservationTime"
            required
            step="300"
            type="time"
          />
          <FieldError messages={state.fieldErrors?.earliestReservationTime} />
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-semibold">Späteste Uhrzeit</span>
          <input
            className="glass-control min-h-12 w-full px-4 outline-none"
            defaultValue={latestReservationTime}
            name="latestReservationTime"
            required
            step="300"
            type="time"
          />
          <FieldError messages={state.fieldErrors?.latestReservationTime} />
        </label>
      </div>

      <button
        className="primary-action w-full sm:ml-auto sm:block sm:w-auto"
        disabled={pending}
        aria-busy={pending}
        type="submit"
      >
        {pending ? "Wird gespeichert..." : "Öffnungszeiten speichern"}
      </button>
    </form>
  );
}
