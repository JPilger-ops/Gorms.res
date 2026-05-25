"use client";

import { useActionState } from "react";
import {
  createReservationRequestAction,
  type ReservationFormState,
} from "@/app/reservieren/actions";

const initialState: ReservationFormState = {};

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) {
    return null;
  }

  return <p className="text-sm font-medium text-danger">{messages[0]}</p>;
}

export function ReservationForm() {
  const [state, formAction, pending] = useActionState(createReservationRequestAction, initialState);

  return (
    <form action={formAction} className="glass-panel space-y-5 p-5 sm:p-7">
      <div className="space-y-2">
        <p className="eyebrow">Reservierungsanfrage</p>
        <h2 className="text-3xl font-semibold leading-tight">Außengastronomie anfragen</h2>
        <p className="text-sm leading-6 text-muted">
          Bitte beachten: Dies ist noch keine Reservierungsbestätigung.
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

      <input
        className="hidden"
        name="website"
        type="text"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
      />

      <div className="grid gap-4 sm:grid-cols-3">
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
          <span className="text-sm font-semibold">Uhrzeit</span>
          <input
            className="glass-control min-h-12 w-full px-4 outline-none"
            name="time"
            type="time"
            min="11:30"
            max="19:00"
            step="900"
            required
          />
          <FieldError messages={state.fieldErrors?.time} />
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-semibold">Personen</span>
          <input
            className="glass-control min-h-12 w-full px-4 outline-none"
            name="guestCount"
            type="number"
            min="1"
            max="30"
            inputMode="numeric"
            required
          />
          <FieldError messages={state.fieldErrors?.guestCount} />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-2">
          <span className="text-sm font-semibold">Name</span>
          <input
            className="glass-control min-h-12 w-full px-4 outline-none"
            name="guestName"
            type="text"
            autoComplete="name"
            required
          />
          <FieldError messages={state.fieldErrors?.guestName} />
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-semibold">E-Mail</span>
          <input
            className="glass-control min-h-12 w-full px-4 outline-none"
            name="email"
            type="email"
            autoComplete="email"
            required
          />
          <FieldError messages={state.fieldErrors?.email} />
        </label>
      </div>

      <label className="block space-y-2">
        <span className="text-sm font-semibold">Telefonnummer</span>
        <input
          className="glass-control min-h-12 w-full px-4 outline-none"
          name="phone"
          type="tel"
          autoComplete="tel"
          required
        />
        <FieldError messages={state.fieldErrors?.phone} />
      </label>

      <label className="block space-y-2">
        <span className="text-sm font-semibold">Nachricht optional</span>
        <textarea
          className="glass-control min-h-28 w-full resize-y px-4 py-3 outline-none"
          name="message"
          maxLength={1000}
        />
        <FieldError messages={state.fieldErrors?.message} />
      </label>

      <label className="flex items-start gap-3 rounded-2xl border border-border bg-surface/65 p-4">
        <input
          className="mt-1 size-4 accent-primary"
          name="privacyAccepted"
          type="checkbox"
          value="true"
          required
        />
        <span className="text-sm leading-6">
          Ich habe den Datenschutzhinweis zur Verarbeitung meiner Angaben für die Bearbeitung der
          Reservierungsanfrage zur Kenntnis genommen.
        </span>
      </label>
      <FieldError messages={state.fieldErrors?.privacyAccepted} />

      <button
        className="primary-action w-full disabled:cursor-not-allowed disabled:opacity-60"
        disabled={pending}
        type="submit"
      >
        {pending ? "Anfrage wird geprüft..." : "Anfrage senden"}
      </button>
    </form>
  );
}
