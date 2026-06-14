import type { CSSProperties } from "react";
import { PrivacyNoticeBanner } from "@/components/reservation/privacy-notice-banner";
import { ReservationForm } from "@/components/reservation/reservation-form";
import { getBrandingSettings } from "@/src/server/branding";
import { getAdminSettings } from "@/src/server/settings";

const facts = [
  "Montags, Dienstags, Sonntags und an Feiertagen sind Reservierungen NICHT möglich.",
  "Reservierungen sind nur in unserem Innenbereich möglich.",
  "Für Gruppen ab 30 Personen ist eine Anzahlung von 100 € notwendig.",
  "Nach dem Absenden erhalten Sie eine Eingangsbestätigung; verbindlich wird die Reservierung erst durch unsere persönliche Zusage.",
];

export async function PublicReservationPage() {
  const [branding, settings] = await Promise.all([getBrandingSettings(), getAdminSettings()]);
  const privacyUrl = settings.privacyPolicyUrl ?? "/datenschutz";

  return (
    <main
      className="app-shell"
      id="main-content"
      style={{ "--primary": branding.accentColor } as CSSProperties}
    >
      <section className="page-frame reservation-frame grid gap-6 py-6 lg:grid-cols-[0.78fr_1.22fr] lg:items-start lg:gap-10 lg:py-14">
        <div className="space-y-6 lg:sticky lg:top-8">
          <div className="intro-panel space-y-5 p-5 sm:p-7">
            {branding.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                alt={settings.appName}
                className="max-h-20 w-auto max-w-full object-contain sm:max-h-24"
                src={branding.logoUrl}
              />
            ) : null}
            <p className="eyebrow">{settings.appName}</p>
            <h1 className="max-w-3xl text-3xl font-semibold leading-[1.08] text-balance sm:text-5xl xl:text-6xl">
              Jetzt einen Platz im Grünen anfragen.
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-muted sm:text-xl">
              Wählen Sie einfach Datum, Uhrzeit und Personenzahl. Wir prüfen Ihre Anfrage persönlich
              und melden uns anschließend bei Ihnen.
            </p>
            <div className="indoor-callout">
              <span aria-hidden="true">Innenbereich</span>
              <p>Reservierungen sind ausschließlich für unseren Innenbereich möglich.</p>
            </div>
          </div>

          <div className="glass-panel space-y-3 p-5 sm:p-6" aria-label="Wichtige Hinweise">
            {facts.map((fact) => (
              <div className="soft-card flex gap-3 px-4 py-3" key={fact}>
                <span
                  className="mt-2 size-2.5 shrink-0 rounded-full bg-success"
                  aria-hidden="true"
                />
                <p className="text-sm leading-6 text-muted">{fact}</p>
              </div>
            ))}
          </div>

          <PrivacyNoticeBanner privacyUrl={privacyUrl} />
        </div>

        <ReservationForm
          imprintUrl={settings.imprintUrl}
          latestReservationTime={settings.latestReservationTime}
          earliestReservationTime={settings.earliestReservationTime}
          manualReviewGuestThreshold={settings.manualReviewGuestThreshold}
          maxGuestsPerRequest={settings.maxGuestsPerRequest}
          privacyNoticeText={settings.privacyNoticeText}
          privacyPolicyUrl={privacyUrl}
        />
      </section>
    </main>
  );
}
