import type { CSSProperties, ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { PrivacyNoticeBanner } from "@/components/reservation/privacy-notice-banner";
import { getBrandingSettings } from "@/src/server/branding";
import { requirePublicHost } from "@/src/server/guards";
import { getAdminSettings } from "@/src/server/settings";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Datenschutz",
  description: "Datenschutzhinweise für Reservierungsanfragen der Waldwirtschaft Heidekönig.",
};

function Section({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section className="soft-card space-y-3 p-5 sm:p-6">
      <h2 className="relative z-10 text-xl font-semibold">{title}</h2>
      <div className="relative z-10 space-y-3 text-sm leading-7 text-muted">{children}</div>
    </section>
  );
}

export default async function PrivacyPage() {
  await requirePublicHost();

  const [branding, settings] = await Promise.all([getBrandingSettings(), getAdminSettings()]);
  const contact = settings.privacyContactEmail;

  return (
    <main
      className="app-shell"
      id="main-content"
      style={{ "--primary": branding.accentColor } as CSSProperties}
    >
      <section className="page-frame grid gap-6 py-6 lg:py-14">
        <div className="intro-panel space-y-5 p-5 sm:p-7">
          <p className="eyebrow">Datenschutz</p>
          <h1 className="max-w-4xl text-3xl font-semibold leading-[1.08] text-balance sm:text-5xl">
            Ihre Daten bleiben auf unserem System.
          </h1>
          <p className="max-w-3xl text-lg leading-8 text-muted">
            Diese Seite beschreibt, welche Daten wir für Reservierungsanfragen verarbeiten. Wir
            nutzen keine Analytics, keine Marketing-Cookies und keine externen Trackingdienste.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link className="secondary-action inline-flex" href="/">
              Zur Reservierungsanfrage
            </Link>
            {settings.imprintUrl ? (
              <a className="secondary-action inline-flex" href={settings.imprintUrl}>
                Impressum
              </a>
            ) : null}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Section title="Verantwortliche Stelle">
            <p>Verantwortlich ist die Betreiberin der Waldwirtschaft Heidekönig.</p>
            {contact ? (
              <p>
                Datenschutz-Kontakt:{" "}
                <a
                  className="font-bold text-primary underline underline-offset-4"
                  href={`mailto:${contact}`}
                >
                  {contact}
                </a>
              </p>
            ) : (
              <p>
                Einen gesonderten Datenschutz-Kontakt können Betreiber im Adminbereich hinterlegen.
                Bis dahin gelten die Kontaktdaten aus dem Impressum.
              </p>
            )}
          </Section>

          <Section title="Zweck der Verarbeitung">
            <p>
              Wir verarbeiten Ihre Angaben ausschließlich, um Ihre Reservierungsanfrage zu prüfen,
              Rückfragen zu stellen und Ihnen eine persönliche Zusage oder Absage zu senden.
            </p>
          </Section>

          <Section title="Welche Daten werden verarbeitet?">
            <ul className="list-disc space-y-2 pl-5">
              <li>Name</li>
              <li>E-Mail-Adresse</li>
              <li>Telefonnummer</li>
              <li>Datum, Uhrzeit und Personenzahl der Anfrage</li>
              <li>Optionale Nachricht</li>
              <li>Zeitpunkt der Anfrage und Bearbeitungsstatus</li>
            </ul>
          </Section>

          <Section title="Was wir nicht verwenden">
            <ul className="list-disc space-y-2 pl-5">
              <li>Keine Analytics</li>
              <li>Keine Marketing-Cookies</li>
              <li>Keine Trackingdienste</li>
              <li>Keine dauerhaft gespeicherten IP-Adressen für Reservierungsdaten</li>
            </ul>
          </Section>

          <Section title="Cookies und lokale Speicherung">
            <p>
              Die öffentliche Reservierungsseite setzt keine Tracking-Cookies. Wenn Sie den
              Datenschutz- und Cookie-Hinweis bestätigen, speichern wir diese Bestätigung lokal in
              Ihrem Browser. Dadurch erscheint der Hinweis bei späteren Besuchen nicht erneut.
            </p>
            <p>
              Admin-Sitzungscookies werden ausschließlich auf der getrennten Login-Domain verwendet
              und stehen der öffentlichen Reservierungsseite nicht zur Verfügung.
            </p>
          </Section>

          <Section title="Speicherdauer">
            <p>
              Reservierungsanfragen werden standardmäßig nach {settings.reservationRetentionDays}{" "}
              Tagen gelöscht. Sicherheits- und Auditprotokolle werden standardmäßig nach{" "}
              {settings.auditLogRetentionDays} Tagen bereinigt.
            </p>
          </Section>

          <Section title="E-Mail-Versand">
            <p>
              Nach dem Absenden senden wir eine interne Benachrichtigung an die zuständige
              Mitarbeiterin und eine automatische Eingangsbestätigung an Sie. Diese
              Eingangsbestätigung ist noch keine Reservierungszusage.
            </p>
          </Section>

          <Section title="Ihre Rechte">
            <p>
              Sie können Auskunft, Berichtigung oder Löschung Ihrer personenbezogenen Daten
              verlangen. Bitte wenden Sie sich dafür an den Datenschutz-Kontakt oder an die im
              Impressum genannte Kontaktadresse.
            </p>
          </Section>
        </div>
      </section>
      <PrivacyNoticeBanner privacyUrl="/datenschutz" />
    </main>
  );
}
