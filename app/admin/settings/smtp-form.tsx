"use client";

import { useActionState } from "react";
import {
  sendSmtpTestAction,
  type SettingsActionState,
  updateSmtpSettingsAction,
} from "@/app/admin/settings/actions";
import type { SmtpSettingsForUi } from "@/src/server/settings";

const initialState: SettingsActionState = {};

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) {
    return null;
  }

  return <p className="text-sm font-medium text-danger">{messages[0]}</p>;
}

function FormMessage({ state }: { state: SettingsActionState }) {
  if (!state.message) {
    return null;
  }

  return (
    <div
      aria-live="polite"
      className={`rounded-2xl border px-4 py-3 text-sm font-medium ${
        state.success ? "border-success bg-surface/80 text-success" : "border-border bg-surface/70"
      }`}
      role={state.success ? "status" : "alert"}
    >
      {state.message}
    </div>
  );
}

function passwordSourceLabel(source: SmtpSettingsForUi["passwordSource"]) {
  if (source === "database") {
    return "Passwort in der Datenbank verschlüsselt gesetzt";
  }

  if (source === "environment") {
    return "Passwort aus der Server-Umgebung gesetzt";
  }

  return "Kein Passwort gesetzt";
}

export function SmtpSettingsForm({
  currentUserEmail,
  settings,
}: {
  currentUserEmail: string;
  settings: SmtpSettingsForUi;
}) {
  const [settingsState, settingsAction, settingsPending] = useActionState(
    updateSmtpSettingsAction,
    initialState,
  );
  const [testState, testAction, testPending] = useActionState(sendSmtpTestAction, initialState);

  return (
    <section className="glass-panel space-y-5 p-4 sm:p-6">
      <div>
        <p className="eyebrow">SMTP / IONOS</p>
        <h3 className="mt-2 text-2xl font-semibold">Mailversand verwalten</h3>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
          Das SMTP-Passwort wird nie angezeigt. Wenn ein neues Passwort eingetragen wird, wird es
          mit dem serverseitigen APP_ENCRYPTION_KEY verschlüsselt gespeichert.
        </p>
      </div>

      <form
        action={settingsAction}
        className="min-w-0 space-y-4 rounded-3xl border border-border bg-surface/55 p-4 sm:p-5"
      >
        <FormMessage state={settingsState} />

        <div className="grid gap-4 md:grid-cols-[1fr_160px]">
          <label className="block space-y-2">
            <span className="text-sm font-semibold">SMTP Host</span>
            <input
              className="glass-control min-h-12 w-full px-4 outline-none"
              defaultValue={settings.host}
              name="smtpHost"
              required
              type="text"
            />
            <FieldError messages={settingsState.fieldErrors?.smtpHost} />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-semibold">Port</span>
            <input
              className="glass-control min-h-12 w-full px-4 outline-none"
              defaultValue={settings.port}
              max={65535}
              min={1}
              name="smtpPort"
              required
              type="number"
            />
            <FieldError messages={settingsState.fieldErrors?.smtpPort} />
          </label>
        </div>

        <label className="block space-y-2">
          <span className="text-sm font-semibold">SMTP User</span>
          <input
            autoComplete="username"
            className="glass-control min-h-12 w-full px-4 outline-none"
            defaultValue={settings.user ?? ""}
            name="smtpUser"
            required
            type="text"
          />
          <FieldError messages={settingsState.fieldErrors?.smtpUser} />
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-semibold">SMTP Passwort ersetzen optional</span>
          <input
            autoComplete="new-password"
            className="glass-control min-h-12 w-full px-4 outline-none"
            name="smtpPassword"
            type="password"
          />
          <FieldError messages={settingsState.fieldErrors?.smtpPassword} />
          <p className="text-xs leading-5 text-muted">
            {passwordSourceLabel(settings.passwordSource)}
          </p>
        </label>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block space-y-2">
            <span className="text-sm font-semibold">From Name</span>
            <input
              className="glass-control min-h-12 w-full px-4 outline-none"
              defaultValue={settings.fromName}
              name="smtpFromName"
              required
              type="text"
            />
            <FieldError messages={settingsState.fieldErrors?.smtpFromName} />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-semibold">From Address</span>
            <input
              autoComplete="email"
              className="glass-control min-h-12 w-full px-4 outline-none"
              defaultValue={settings.fromAddress ?? ""}
              name="smtpFromAddress"
              required
              type="email"
            />
            <FieldError messages={settingsState.fieldErrors?.smtpFromAddress} />
          </label>
        </div>

        <button
          className="primary-action w-full disabled:cursor-not-allowed disabled:opacity-60"
          disabled={settingsPending}
          aria-busy={settingsPending}
          type="submit"
        >
          {settingsPending ? "Wird gespeichert..." : "SMTP-Einstellungen speichern"}
        </button>
      </form>

      <form
        action={testAction}
        className="min-w-0 space-y-4 rounded-3xl border border-border bg-surface/55 p-4 sm:p-5"
      >
        <div>
          <h4 className="text-lg font-semibold">Testmail senden</h4>
          <p className="mt-1 text-sm leading-6 text-muted">
            Verwendet die aktuell gespeicherte SMTP-Konfiguration.
          </p>
        </div>

        <FormMessage state={testState} />

        <label className="block space-y-2">
          <span className="text-sm font-semibold">Empfänger für Testmail</span>
          <input
            autoComplete="email"
            className="glass-control min-h-12 w-full px-4 outline-none"
            defaultValue={currentUserEmail}
            name="testEmail"
            required
            type="email"
          />
          <FieldError messages={testState.fieldErrors?.testEmail} />
        </label>

        <button
          className="secondary-action w-full disabled:cursor-not-allowed disabled:opacity-60"
          disabled={testPending}
          aria-busy={testPending}
          type="submit"
        >
          {testPending ? "Wird gesendet..." : "Testmail senden"}
        </button>
      </form>
    </section>
  );
}
