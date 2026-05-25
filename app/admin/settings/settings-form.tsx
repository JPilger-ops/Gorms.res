"use client";

import { useActionState } from "react";
import { updateSettingsAction, type SettingsActionState } from "@/app/admin/settings/actions";
import { supportedEmailTemplateVariables } from "@/src/server/email-templates";
import type { AdminSettings } from "@/src/server/settings";

const initialState: SettingsActionState = {};

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) {
    return null;
  }

  return <p className="text-sm font-medium text-danger">{messages[0]}</p>;
}

function Section({
  children,
  description,
  title,
}: {
  children: React.ReactNode;
  description: string;
  title: string;
}) {
  return (
    <section className="rounded-3xl border border-border bg-surface/55 p-4 sm:p-5">
      <div className="mb-4">
        <h3 className="text-xl font-semibold">{title}</h3>
        <p className="mt-2 text-sm leading-6 text-muted">{description}</p>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

export function SettingsForm({ settings }: { settings: AdminSettings }) {
  const [state, formAction, pending] = useActionState(updateSettingsAction, initialState);

  return (
    <form action={formAction} className="glass-panel space-y-5 p-5 sm:p-6">
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

      <Section
        description="Allgemeine Anzeige und öffentliche URL. Die Domain-Routing-Regeln bleiben weiterhin serverseitig geschützt."
        title="App"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block space-y-2">
            <span className="text-sm font-semibold">App-Name</span>
            <input
              className="glass-control min-h-12 w-full px-4 outline-none"
              defaultValue={settings.appName}
              name="appName"
              required
              type="text"
            />
            <FieldError messages={state.fieldErrors?.appName} />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-semibold">Öffentliche Website-URL</span>
            <input
              className="glass-control min-h-12 w-full px-4 outline-none"
              defaultValue={settings.publicSiteUrl}
              name="publicSiteUrl"
              required
              type="url"
            />
            <FieldError messages={state.fieldErrors?.publicSiteUrl} />
          </label>
        </div>
      </Section>

      <Section
        description="Diese Regeln werden beim Absenden jeder öffentlichen Reservierungsanfrage serverseitig geprüft."
        title="Reservierungsregeln"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block space-y-2">
            <span className="text-sm font-semibold">Maximale Personenanzahl</span>
            <input
              className="glass-control min-h-12 w-full px-4 outline-none"
              defaultValue={settings.maxGuestsPerRequest}
              min={1}
              name="maxGuestsPerRequest"
              required
              type="number"
            />
            <FieldError messages={state.fieldErrors?.maxGuestsPerRequest} />
          </label>

          <label className="flex min-h-12 items-center gap-3 self-end rounded-2xl border border-border bg-surface/55 px-4">
            <input
              className="h-4 w-4"
              defaultChecked={settings.blockSundays}
              name="blockSundays"
              type="checkbox"
              value="true"
            />
            <span className="text-sm font-semibold">Sonntage blockieren</span>
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block space-y-2">
            <span className="text-sm font-semibold">Früheste Reservierungsuhrzeit</span>
            <input
              className="glass-control min-h-12 w-full px-4 outline-none"
              defaultValue={settings.earliestReservationTime}
              name="earliestReservationTime"
              required
              step="300"
              type="time"
            />
            <FieldError messages={state.fieldErrors?.earliestReservationTime} />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-semibold">Späteste Reservierungsuhrzeit</span>
            <input
              className="glass-control min-h-12 w-full px-4 outline-none"
              defaultValue={settings.latestReservationTime}
              name="latestReservationTime"
              required
              step="300"
              type="time"
            />
            <FieldError messages={state.fieldErrors?.latestReservationTime} />
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block space-y-2">
            <span className="text-sm font-semibold">Feiertagsland</span>
            <input
              className="glass-control min-h-12 w-full px-4 outline-none"
              defaultValue={settings.holidayCountry}
              name="holidayCountry"
              required
              type="text"
            />
            <FieldError messages={state.fieldErrors?.holidayCountry} />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-semibold">Feiertagsbundesland</span>
            <input
              className="glass-control min-h-12 w-full px-4 outline-none"
              defaultValue={settings.holidayState}
              name="holidayState"
              required
              type="text"
            />
            <FieldError messages={state.fieldErrors?.holidayState} />
            <p className="text-xs leading-5 text-muted">
              Für Nordrhein-Westfalen verwendet date-holidays den Wert NW.
            </p>
          </label>
        </div>
      </Section>

      <Section
        description="Betreffzeilen für die interne Mitarbeiter-Mail und die automatische Eingangsbestätigung an Gäste."
        title="E-Mail-Betreff-Templates"
      >
        <div className="rounded-2xl border border-border bg-surface/65 p-4 text-sm leading-6 text-muted">
          Unterstützte Variablen:{" "}
          <span className="font-semibold text-foreground">
            {supportedEmailTemplateVariables.map((variable) => `{{${variable}}}`).join(", ")}
          </span>
        </div>

        <label className="block space-y-2">
          <span className="text-sm font-semibold">Empfängeradresse für Reservierungsanfragen</span>
          <input
            className="glass-control min-h-12 w-full px-4 outline-none"
            defaultValue={settings.reservationNotificationEmail}
            name="reservationNotificationEmail"
            required
            type="email"
          />
          <FieldError messages={state.fieldErrors?.reservationNotificationEmail} />
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-semibold">Interner Betreff</span>
          <input
            className="glass-control min-h-12 w-full px-4 outline-none"
            defaultValue={settings.internalEmailSubjectTemplate}
            name="internalEmailSubjectTemplate"
            required
            type="text"
          />
          <FieldError messages={state.fieldErrors?.internalEmailSubjectTemplate} />
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-semibold">Gast-Eingangsbestätigung Betreff</span>
          <input
            className="glass-control min-h-12 w-full px-4 outline-none"
            defaultValue={settings.guestEmailSubjectTemplate}
            name="guestEmailSubjectTemplate"
            required
            type="text"
          />
          <FieldError messages={state.fieldErrors?.guestEmailSubjectTemplate} />
        </label>
      </Section>

      <Section
        description="Datenschutztexte und automatische Aufbewahrungsfristen. Die eigentliche Löschung wird im Retention-Schritt ergänzt."
        title="Datenschutz und Aufbewahrung"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block space-y-2">
            <span className="text-sm font-semibold">Reservierungsanfragen aufbewahren</span>
            <input
              className="glass-control min-h-12 w-full px-4 outline-none"
              defaultValue={settings.reservationRetentionDays}
              min={1}
              name="reservationRetentionDays"
              required
              type="number"
            />
            <FieldError messages={state.fieldErrors?.reservationRetentionDays} />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-semibold">Audit-Logs aufbewahren</span>
            <input
              className="glass-control min-h-12 w-full px-4 outline-none"
              defaultValue={settings.auditLogRetentionDays}
              min={1}
              name="auditLogRetentionDays"
              required
              type="number"
            />
            <FieldError messages={state.fieldErrors?.auditLogRetentionDays} />
          </label>
        </div>

        <label className="block space-y-2">
          <span className="text-sm font-semibold">Datenschutz-Kontakt-E-Mail optional</span>
          <input
            className="glass-control min-h-12 w-full px-4 outline-none"
            defaultValue={settings.privacyContactEmail ?? ""}
            name="privacyContactEmail"
            type="email"
          />
          <FieldError messages={state.fieldErrors?.privacyContactEmail} />
        </label>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block space-y-2">
            <span className="text-sm font-semibold">Datenschutzlink optional</span>
            <input
              className="glass-control min-h-12 w-full px-4 outline-none"
              defaultValue={settings.privacyPolicyUrl ?? ""}
              name="privacyPolicyUrl"
              type="url"
            />
            <FieldError messages={state.fieldErrors?.privacyPolicyUrl} />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-semibold">Impressumslink optional</span>
            <input
              className="glass-control min-h-12 w-full px-4 outline-none"
              defaultValue={settings.imprintUrl ?? ""}
              name="imprintUrl"
              type="url"
            />
            <FieldError messages={state.fieldErrors?.imprintUrl} />
          </label>
        </div>

        <label className="block space-y-2">
          <span className="text-sm font-semibold">Datenschutzhinweis</span>
          <textarea
            className="glass-control min-h-32 w-full resize-y px-4 py-3 outline-none"
            defaultValue={settings.privacyNoticeText}
            name="privacyNoticeText"
            required
          />
          <FieldError messages={state.fieldErrors?.privacyNoticeText} />
        </label>
      </Section>

      <button
        className="primary-action w-full disabled:cursor-not-allowed disabled:opacity-60"
        disabled={pending}
        type="submit"
      >
        {pending ? "Wird gespeichert..." : "Einstellungen speichern"}
      </button>
    </form>
  );
}
