"use client";

import { useActionState } from "react";
import { updateSettingsAction, type SettingsActionState } from "@/app/admin/settings/actions";
import { FieldError, FormFeedback } from "@/components/ui/form-feedback";
import { supportedEmailTemplateVariables } from "@/src/server/email-templates";
import type { AdminSettings } from "@/src/server/settings";

const initialState: SettingsActionState = {};

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
    <section className="admin-settings-section">
      <div className="admin-settings-section-header">
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="mt-2 text-sm leading-6 text-muted">{description}</p>
      </div>
      <div className="admin-settings-section-body">{children}</div>
    </section>
  );
}

export function SettingsForm({ settings }: { settings: AdminSettings }) {
  const [state, formAction, pending] = useActionState(updateSettingsAction, initialState);

  return (
    <form action={formAction} className="glass-panel admin-panel space-y-5 p-4 sm:p-6">
      <FormFeedback state={state} />

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

          <label className="block space-y-2">
            <span className="text-sm font-semibold">Manuelle Prüfung ab Personen</span>
            <input
              className="glass-control min-h-12 w-full px-4 outline-none"
              defaultValue={settings.manualReviewGuestThreshold}
              min={1}
              name="manualReviewGuestThreshold"
              required
              type="number"
            />
            <FieldError messages={state.fieldErrors?.manualReviewGuestThreshold} />
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block space-y-2">
            <span className="text-sm font-semibold">Innenkapazität Sitzplätze</span>
            <input
              className="glass-control min-h-12 w-full px-4 outline-none"
              defaultValue={settings.indoorCapacity}
              min={1}
              name="indoorCapacity"
              required
              type="number"
            />
            <FieldError messages={state.fieldErrors?.indoorCapacity} />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-semibold">Aufenthaltsdauer Minuten</span>
            <input
              className="glass-control min-h-12 w-full px-4 outline-none"
              defaultValue={settings.standardOccupancyMinutes}
              min={15}
              name="standardOccupancyMinutes"
              required
              type="number"
            />
            <FieldError messages={state.fieldErrors?.standardOccupancyMinutes} />
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block space-y-2">
            <span className="text-sm font-semibold">Slotgröße Minuten</span>
            <input
              className="glass-control min-h-12 w-full px-4 outline-none"
              defaultValue={settings.reservationSlotMinutes}
              min={5}
              name="reservationSlotMinutes"
              required
              type="number"
            />
            <FieldError messages={state.fieldErrors?.reservationSlotMinutes} />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-semibold">Puffer vor Küchenannahme Minuten</span>
            <input
              className="glass-control min-h-12 w-full px-4 outline-none"
              defaultValue={settings.latestReservationBufferMinutes}
              min={0}
              name="latestReservationBufferMinutes"
              required
              type="number"
            />
            <FieldError messages={state.fieldErrors?.latestReservationBufferMinutes} />
          </label>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="admin-toggle-card">
            <input
              className="h-4 w-4"
              defaultChecked={settings.blockMondays}
              name="blockMondays"
              type="checkbox"
              value="true"
            />
            <span className="text-sm font-semibold">Montage blockieren</span>
          </label>

          <label className="admin-toggle-card">
            <input
              className="h-4 w-4"
              defaultChecked={settings.blockTuesdays}
              name="blockTuesdays"
              type="checkbox"
              value="true"
            />
            <span className="text-sm font-semibold">Dienstage blockieren</span>
          </label>

          <label className="admin-toggle-card">
            <input
              className="h-4 w-4"
              defaultChecked={settings.blockSundays}
              name="blockSundays"
              type="checkbox"
              value="true"
            />
            <span className="text-sm font-semibold">Sonntage blockieren</span>
          </label>

          <label className="admin-toggle-card">
            <input
              className="h-4 w-4"
              defaultChecked={settings.blockPublicHolidays}
              name="blockPublicHolidays"
              type="checkbox"
              value="true"
            />
            <span className="text-sm font-semibold">NRW-Feiertage blockieren</span>
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
            <span className="text-sm font-semibold">Absolute späteste Reservierungsuhrzeit</span>
            <input
              className="glass-control min-h-12 w-full px-4 outline-none"
              defaultValue={settings.latestReservationTime}
              name="latestReservationTime"
              required
              step="300"
              type="time"
            />
            <FieldError messages={state.fieldErrors?.latestReservationTime} />
            <p className="text-xs leading-5 text-muted">
              Saisonale Küchenannahme minus Puffer kann diese Zeit weiter einschränken.
            </p>
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block space-y-2">
            <span className="text-sm font-semibold">Sommer Saisonstart</span>
            <input
              className="glass-control min-h-12 w-full px-4 outline-none"
              defaultValue={settings.summerSeasonStart}
              name="summerSeasonStart"
              placeholder="04-01"
              required
              type="text"
            />
            <FieldError messages={state.fieldErrors?.summerSeasonStart} />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-semibold">Sommer Saisonende</span>
            <input
              className="glass-control min-h-12 w-full px-4 outline-none"
              defaultValue={settings.summerSeasonEnd}
              name="summerSeasonEnd"
              placeholder="10-31"
              required
              type="text"
            />
            <FieldError messages={state.fieldErrors?.summerSeasonEnd} />
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block space-y-2">
            <span className="text-sm font-semibold">Küchenannahme Sommer bis</span>
            <input
              className="glass-control min-h-12 w-full px-4 outline-none"
              defaultValue={settings.summerKitchenAcceptanceUntil}
              name="summerKitchenAcceptanceUntil"
              required
              step="300"
              type="time"
            />
            <FieldError messages={state.fieldErrors?.summerKitchenAcceptanceUntil} />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-semibold">Küchenannahme Winter bis</span>
            <input
              className="glass-control min-h-12 w-full px-4 outline-none"
              defaultValue={settings.winterKitchenAcceptanceUntil}
              name="winterKitchenAcceptanceUntil"
              required
              step="300"
              type="time"
            />
            <FieldError messages={state.fieldErrors?.winterKitchenAcceptanceUntil} />
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
        <div className="admin-message-preview text-sm leading-6 text-muted">
          Unterstützte Variablen:{" "}
          <span className="font-semibold text-foreground break-words">
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
        description="Datenschutztexte und automatische Aufbewahrungsfristen. Die Bereinigung anonymisiert personenbezogene Reservierungs- und E-Mail-Daten und löscht alte Audit-Logs."
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
        className="primary-action w-full sm:ml-auto sm:block sm:w-auto"
        disabled={pending}
        aria-busy={pending}
        type="submit"
      >
        {pending ? "Wird gespeichert..." : "Einstellungen speichern"}
      </button>
    </form>
  );
}
