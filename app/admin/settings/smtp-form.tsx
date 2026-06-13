"use client";

import { useActionState } from "react";
import {
  sendSmtpTestAction,
  type SettingsActionState,
  updateSmtpSettingsAction,
} from "@/app/admin/settings/actions";
import { FieldError, FormFeedback } from "@/components/ui/form-feedback";
import type { SmtpSettingsForUi } from "@/src/server/settings";

const initialState: SettingsActionState = {};

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
    <section className="glass-panel admin-panel space-y-5 p-4 sm:p-6">
      <div className="admin-settings-intro">
        <p className="eyebrow">SMTP / IONOS</p>
        <h3 className="mt-2 text-2xl font-semibold">Mailversand verwalten</h3>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
          Das SMTP-Passwort wird nie angezeigt. Wenn ein neues Passwort eingetragen wird, wird es
          mit dem serverseitigen APP_ENCRYPTION_KEY verschlüsselt gespeichert.
        </p>
      </div>

      <form action={settingsAction} className="admin-settings-section">
        <div className="admin-settings-section-header">
          <h4 className="text-lg font-semibold">SMTP-Zugang</h4>
          <p className="mt-2 text-sm leading-6 text-muted">
            Zugangsdaten und Absender. Passwortwerte werden nie zurück an den Browser gegeben.
          </p>
        </div>

        <div className="admin-settings-section-body">
          <FormFeedback state={settingsState} />

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
            <p className="admin-message-preview text-xs leading-5 text-muted">
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
            className="primary-action w-full sm:ml-auto sm:block sm:w-auto"
            disabled={settingsPending}
            aria-busy={settingsPending}
            type="submit"
          >
            {settingsPending ? "Wird gespeichert..." : "SMTP-Einstellungen speichern"}
          </button>
        </div>
      </form>

      <form action={testAction} className="admin-settings-section">
        <div className="admin-settings-section-header">
          <h4 className="text-lg font-semibold">Testmail senden</h4>
          <p className="mt-1 text-sm leading-6 text-muted">
            Verwendet die aktuell gespeicherte SMTP-Konfiguration.
          </p>
        </div>

        <div className="admin-settings-section-body">
          <FormFeedback state={testState} />

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
            className="secondary-action w-full sm:ml-auto sm:block sm:w-auto"
            disabled={testPending}
            aria-busy={testPending}
            type="submit"
          >
            {testPending ? "Wird gesendet..." : "Testmail senden"}
          </button>
        </div>
      </form>
    </section>
  );
}
