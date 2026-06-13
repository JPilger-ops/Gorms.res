"use client";

import { useActionState } from "react";
import {
  runRetentionCleanupAction,
  type RetentionCleanupActionState,
} from "@/app/admin/settings/actions";
import { FormFeedback } from "@/components/ui/form-feedback";

const initialState: RetentionCleanupActionState = {};

export function RetentionCleanupForm() {
  const [state, formAction, pending] = useActionState(runRetentionCleanupAction, initialState);

  return (
    <section className="glass-panel admin-panel space-y-4 p-5 sm:p-6">
      <div className="admin-settings-intro">
        <p className="eyebrow">Aufbewahrung</p>
        <h3 className="mt-2 text-2xl font-semibold">Alte Daten bereinigen</h3>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
          Anonymisiert personenbezogene Reservierungs- und Maildaten und löscht Audit-Logs, die
          älter als die konfigurierten Aufbewahrungsfristen sind. Es werden keine personenbezogenen
          Details protokolliert.
        </p>
      </div>

      <FormFeedback state={state} />
      {state.success ? (
        <p className="admin-message-preview text-sm font-semibold text-muted">
          Reservierungsanfragen anonymisiert: {state.reservationsAnonymized ?? 0}. Mailverläufe
          anonymisiert: {state.outgoingEmailsAnonymized ?? 0}. Audit-Logs gelöscht:{" "}
          {state.auditLogsDeleted ?? 0}.
        </p>
      ) : null}

      <form action={formAction}>
        <button
          className="secondary-action w-full sm:w-auto"
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
