import { ReservationForm } from "@/components/reservation/reservation-form";
import { getAdminSettings } from "@/src/server/settings";

const facts = [
  "Sonntage, Feiertage und gesperrte Tage werden automatisch blockiert.",
  "Die Reservierung gilt erst nach persönlicher Bestätigung.",
  "Ihre Daten werden nur zur Bearbeitung der Anfrage verwendet.",
];

export async function PublicReservationPage() {
  const settings = await getAdminSettings();

  return (
    <main className="app-shell">
      <section className="page-frame grid gap-8 py-8 lg:grid-cols-[0.88fr_1.12fr] lg:items-start lg:py-14">
        <div className="space-y-8 lg:sticky lg:top-8">
          <div className="space-y-5">
            <p className="eyebrow">Waldwirtschaft Heidekönig</p>
            <h1 className="max-w-3xl text-4xl font-semibold leading-[1.05] text-balance sm:text-6xl">
              Anfrage für einen Platz im Grünen.
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-muted sm:text-xl">
              Senden Sie uns Ihre Wunschzeit für die Außengastronomie. Wir prüfen die Anfrage
              persönlich und melden uns anschließend bei Ihnen.
            </p>
          </div>

          <div className="glass-panel space-y-3 p-5 sm:p-6" aria-label="Wichtige Hinweise">
            {facts.map((fact) => (
              <div className="flex gap-3" key={fact}>
                <span
                  className="mt-2 size-2.5 shrink-0 rounded-full bg-success"
                  aria-hidden="true"
                />
                <p className="text-sm leading-6 text-muted">{fact}</p>
              </div>
            ))}
          </div>

          <div className="rounded-3xl border border-border bg-surface/65 p-5 text-sm leading-6 text-muted">
            Vielen Dank für Ihre Anfrage. Die Reservierung ist erst nach unserer persönlichen
            Bestätigung gültig.
          </div>
        </div>

        <ReservationForm
          imprintUrl={settings.imprintUrl}
          latestReservationTime={settings.latestReservationTime}
          earliestReservationTime={settings.earliestReservationTime}
          maxGuestsPerRequest={settings.maxGuestsPerRequest}
          privacyNoticeText={settings.privacyNoticeText}
          privacyPolicyUrl={settings.privacyPolicyUrl}
        />
      </section>
    </main>
  );
}
