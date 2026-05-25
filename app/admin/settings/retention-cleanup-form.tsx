"use client";

import { useActionState } from "react";
import {
  runRetentionCleanupAction,
  type RetentionCleanupActionState,
} from "@/app/admin/settings/actions";

const initialState: RetentionCleanupActionState = {};

export function RetentionCleanupForm() {
  const [state, formAction, pending] = useActionState(runRetentionCleanupAction, initialState);

  return (
    <section className="glass-panel space-y-4 p-5 sm:p-6">
      <div>
        <p className="eyebrow">Aufbewahrung</p>
        <h3 className="mt-2 text-2xl font-semibold">Alte Daten bereinigen</h3>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
          Löscht Reservierungsanfragen und Audit-Logs, die älter als die konfigurierten
          Aufbewahrungsfristen sind. Es werden keine personenbezogenen Details protokolliert.
        </p>
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
          {state.success ? (
            <span className="mt-1 block text-muted">
              Reservierungsanfragen gelöscht: {state.reservationsDeleted ?? 0}. Audit-Logs gelöscht:{" "}
              {state.auditLogsDeleted ?? 0}.
            </span>
          ) : null}
        </div>
      ) : null}

      <form action={formAction}>
        <button
          className="secondary-action w-full disabled:cursor-not-allowed disabled:opacity-60"
          disabled={pending}
          aria-busy={pending}
          type="submit"
        >
          {pending ? "Bereinigung läuft..." : "Jetzt bereinigen"}
        </button>
      </form>
    </section>
  );
}
