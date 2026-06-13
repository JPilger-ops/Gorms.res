"use client";

import { useActionState } from "react";
import {
  createBlockedDayAction,
  type BlockedDayActionState,
} from "@/app/admin/blocked-days/actions";
import { FieldError, FormFeedback } from "@/components/ui/form-feedback";

const initialState: BlockedDayActionState = {};

export function BlockedDayForm() {
  const [state, formAction, pending] = useActionState(createBlockedDayAction, initialState);

  return (
    <form action={formAction} className="glass-panel admin-panel space-y-4 p-5 sm:p-6">
      <div>
        <p className="eyebrow">Sperrtag</p>
        <h3 className="mt-2 text-2xl font-semibold">Tag blockieren</h3>
        <p className="mt-2 text-sm leading-6 text-muted">
          Für einzelne Tage, an denen keine Anfrage möglich sein soll.
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
        className="primary-action w-full"
        disabled={pending}
        aria-busy={pending}
        type="submit"
      >
        {pending ? "Wird gespeichert..." : "Sperrtag speichern"}
      </button>
    </form>
  );
}
