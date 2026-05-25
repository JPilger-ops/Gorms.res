"use client";

import { useActionState } from "react";
import {
  createBlockedDayAction,
  type BlockedDayActionState,
} from "@/app/admin/blocked-days/actions";

const initialState: BlockedDayActionState = {};

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) {
    return null;
  }

  return <p className="text-sm font-medium text-danger">{messages[0]}</p>;
}

export function BlockedDayForm() {
  const [state, formAction, pending] = useActionState(createBlockedDayAction, initialState);

  return (
    <form action={formAction} className="glass-panel space-y-4 p-5 sm:p-6">
      <div>
        <p className="eyebrow">Sperrtag</p>
        <h3 className="mt-2 text-2xl font-semibold">Tag blockieren</h3>
      </div>

      {state.message ? (
        <div
          aria-live="polite"
          className={`rounded-2xl border px-4 py-3 text-sm font-medium ${
            state.success
              ? "border-success bg-surface/80 text-success"
              : "border-border bg-surface/70"
          }`}
          role={state.success ? "status" : "alert"}
        >
          {state.message}
        </div>
      ) : null}

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
        <span className="text-sm font-semibold">Begründung optional</span>
        <input
          className="glass-control min-h-12 w-full px-4 outline-none"
          name="reason"
          type="text"
          maxLength={240}
        />
        <FieldError messages={state.fieldErrors?.reason} />
      </label>

      <button
        className="primary-action w-full disabled:cursor-not-allowed disabled:opacity-60"
        disabled={pending}
        aria-busy={pending}
        type="submit"
      >
        {pending ? "Wird gespeichert..." : "Sperrtag speichern"}
      </button>
    </form>
  );
}
