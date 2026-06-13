import { AdminShell } from "@/components/admin/admin-shell";
import { OpeningHoursForm } from "@/app/admin/opening-hours/opening-hours-form";
import { requirePermission } from "@/src/server/guards";
import { getBusinessSettings } from "@/src/server/settings";

export const dynamic = "force-dynamic";

export default async function OpeningHoursPage() {
  const session = await requirePermission("opening-hours:manage");
  const settings = await getBusinessSettings();

  return (
    <AdminShell session={session}>
      <div className="space-y-6">
        <div className="glass-panel admin-hero p-5 sm:p-7">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="eyebrow">Öffnungszeiten</p>
              <h2 className="mt-2 text-3xl font-semibold">Reservierungszeiten verwalten</h2>
            </div>
            <p className="max-w-2xl text-sm leading-6 text-muted">
              Admins und Mitarbeiter legen hier fest, in welchem Zeitraum Gäste neue
              Reservierungsanfragen stellen dürfen.
            </p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="admin-stat-card">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted">Start</p>
            <p className="mt-3 text-3xl font-semibold">{settings.earliestReservationTime}</p>
            <p className="mt-2 text-sm text-muted">früheste Anfragezeit</p>
          </div>
          <div className="admin-stat-card">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted">Ende</p>
            <p className="mt-3 text-3xl font-semibold">{settings.latestReservationTime}</p>
            <p className="mt-2 text-sm text-muted">späteste Anfragezeit</p>
          </div>
          <div className="admin-stat-card">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted">Prüfung</p>
            <p className="mt-3 text-lg font-semibold">Serverseitig aktiv</p>
            <p className="mt-2 text-sm text-muted">gilt direkt für neue Anfragen</p>
          </div>
        </div>

        <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_0.8fr]">
          <OpeningHoursForm
            earliestReservationTime={settings.earliestReservationTime}
            latestReservationTime={settings.latestReservationTime}
          />

          <section className="glass-panel admin-panel p-5 sm:p-6">
            <p className="eyebrow">Aktiv</p>
            <h3 className="mt-2 text-2xl font-semibold">Aktuelle Regel</h3>
            <div className="admin-list-card mt-5 p-5">
              <p className="text-sm text-muted">Anfragen sind aktuell möglich von</p>
              <p className="mt-2 text-3xl font-semibold">
                {settings.earliestReservationTime} bis {settings.latestReservationTime}
              </p>
            </div>
            <p className="admin-message-preview mt-4 text-sm leading-6 text-muted">
              Die Prüfung erfolgt serverseitig beim Absenden. Bestehende Anfragen werden durch eine
              Änderung nicht verändert.
            </p>
          </section>
        </div>
      </div>
    </AdminShell>
  );
}
