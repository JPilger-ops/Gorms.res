"use client";

import { useActionState } from "react";
import {
  updateOpeningHoursAction,
  type OpeningHoursActionState,
} from "@/app/admin/opening-hours/actions";

const initialState: OpeningHoursActionState = {};

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) {
    return null;
  }

  return <p className="text-sm font-medium text-danger">{messages[0]}</p>;
}

export function OpeningHoursForm({
  earliestReservationTime,
  latestReservationTime,
}: {
  earliestReservationTime: string;
  latestReservationTime: string;
}) {
  const [state, formAction, pending] = useActionState(updateOpeningHoursAction, initialState);

  return (
    <form action={formAction} className="glass-panel space-y-4 p-5 sm:p-6">
      <div>
        <p className="eyebrow">Zeitraum</p>
        <h3 className="mt-2 text-2xl font-semibold">Reservierungszeiten</h3>
        <p className="mt-2 text-sm leading-6 text-muted">
          Diese Zeiten begrenzen neue Reservierungsanfragen im öffentlichen Formular.
        </p>
      </div>

      {state.message ? (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm font-medium ${
            state.success
              ? "border-success bg-surface/80 text-success"
              : "border-border bg-surface/70"
          }`}
        >
          {state.message}
        </div>
      ) : null}

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
        className="primary-action w-full disabled:cursor-not-allowed disabled:opacity-60"
        disabled={pending}
        type="submit"
      >
        {pending ? "Wird gespeichert..." : "Öffnungszeiten speichern"}
      </button>
    </form>
  );
}
