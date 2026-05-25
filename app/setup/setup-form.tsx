"use client";

import { useActionState } from "react";
import { createInitialAdminAction, type SetupActionState } from "@/app/setup/actions";

const initialState: SetupActionState = {};

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) {
    return null;
  }

  return <p className="text-sm font-medium text-danger">{messages[0]}</p>;
}

export function SetupForm() {
  const [state, formAction, pending] = useActionState(createInitialAdminAction, initialState);

  return (
    <form action={formAction} className="glass-panel space-y-5 p-5 sm:p-7">
      <div className="space-y-2">
        <p className="eyebrow">Setup-Wizard</p>
        <h1 className="text-3xl font-semibold leading-tight sm:text-4xl">Ersten Admin anlegen</h1>
        <p className="text-sm leading-6 text-muted">
          Der Setup-Token kommt aus der Server-Umgebung und wird nicht gespeichert.
        </p>
      </div>

      {state.message ? (
        <div
          aria-live="polite"
          className="rounded-2xl border border-border bg-surface/70 px-4 py-3 text-sm font-medium"
          role="alert"
        >
          {state.message}
        </div>
      ) : null}

      <label className="block space-y-2">
        <span className="text-sm font-semibold">Setup-Token</span>
        <input
          className="glass-control min-h-12 w-full px-4 outline-none"
          name="setupToken"
          type="password"
          autoComplete="one-time-code"
          required
        />
        <FieldError messages={state.fieldErrors?.setupToken} />
      </label>

      <label className="block space-y-2">
        <span className="text-sm font-semibold">Name</span>
        <input
          className="glass-control min-h-12 w-full px-4 outline-none"
          name="name"
          type="text"
          autoComplete="name"
          required
        />
        <FieldError messages={state.fieldErrors?.name} />
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

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-2">
          <span className="text-sm font-semibold">Passwort</span>
          <input
            className="glass-control min-h-12 w-full px-4 outline-none"
            name="password"
            type="password"
            autoComplete="new-password"
            required
          />
          <FieldError messages={state.fieldErrors?.password} />
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-semibold">Passwort bestätigen</span>
          <input
            className="glass-control min-h-12 w-full px-4 outline-none"
            name="passwordConfirm"
            type="password"
            autoComplete="new-password"
            required
          />
          <FieldError messages={state.fieldErrors?.passwordConfirm} />
        </label>
      </div>

      <button
        className="primary-action w-full disabled:cursor-not-allowed disabled:opacity-60"
        disabled={pending}
        aria-busy={pending}
        type="submit"
      >
        {pending ? "Setup wird abgeschlossen..." : "Setup abschließen"}
      </button>
    </form>
  );
}
