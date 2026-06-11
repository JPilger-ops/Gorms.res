"use client";

import { useActionState } from "react";
import { loginAction, type LoginActionState } from "@/app/login/actions";
import { FieldError, FormFeedback } from "@/components/ui/form-feedback";

const initialState: LoginActionState = {};

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <form action={formAction} className="glass-panel space-y-5 p-5 sm:p-7">
      <div className="space-y-2">
        <p className="eyebrow">Admin-Login</p>
        <h1 className="text-3xl font-semibold leading-tight sm:text-4xl">Anmelden</h1>
        <p className="text-sm leading-6 text-muted">
          Zugriff nur für berechtigte Benutzerinnen und Benutzer.
        </p>
      </div>

      <FormFeedback state={state} />

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

      <label className="block space-y-2">
        <span className="text-sm font-semibold">Passwort</span>
        <input
          className="glass-control min-h-12 w-full px-4 outline-none"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
        <FieldError messages={state.fieldErrors?.password} />
      </label>

      <button
        className="primary-action w-full"
        disabled={pending}
        aria-busy={pending}
        type="submit"
      >
        {pending ? "Anmeldung wird geprüft..." : "Anmelden"}
      </button>
    </form>
  );
}
