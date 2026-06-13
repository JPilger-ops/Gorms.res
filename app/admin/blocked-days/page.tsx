import { AdminShell } from "@/components/admin/admin-shell";
import {
  deleteBlockedDayAction,
  deleteReservationEventAction,
} from "@/app/admin/blocked-days/actions";
import { BlockedDayForm } from "@/app/admin/blocked-days/blocked-day-form";
import { ReservationEventForm } from "@/app/admin/blocked-days/reservation-event-form";
import { getBlockedDays } from "@/src/server/blocked-days";
import { requirePermission } from "@/src/server/guards";
import { listReservationEvents } from "@/src/server/reservation-events";

export const dynamic = "force-dynamic";

function formatDisplayDate(date: string) {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    weekday: "short",
    year: "numeric",
  }).format(new Date(`${date}T00:00:00`));
}

export default async function BlockedDaysPage() {
  const session = await requirePermission("blocked-days:manage");
  const [days, events] = await Promise.all([getBlockedDays(), listReservationEvents()]);
  const blockingEvents = events.filter((event) => !event.reservationsAllowed).length;
  const openEvents = events.length - blockingEvents;

  return (
    <AdminShell session={session}>
      <div className="space-y-6">
        <div className="glass-panel admin-hero p-5 sm:p-7">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="eyebrow">Blockierte Tage</p>
              <h2 className="mt-2 text-3xl font-semibold">Sperrtage und Events</h2>
            </div>
            <p className="max-w-2xl text-sm leading-6 text-muted">
              Hier gepflegte Sperren werden im öffentlichen Reservierungsformular serverseitig
              berücksichtigt. Eventtage können zusätzlich einen öffentlichen Hinweis anzeigen.
            </p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="admin-stat-card">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted">Sperrtage</p>
            <p className="mt-3 text-3xl font-semibold">{days.length}</p>
            <p className="mt-2 text-sm text-muted">kommende manuelle Sperren</p>
          </div>
          <div className="admin-stat-card">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted">Blockierend</p>
            <p className="mt-3 text-3xl font-semibold">{blockingEvents}</p>
            <p className="mt-2 text-sm text-muted">Eventtage ohne normale Anfragen</p>
          </div>
          <div className="admin-stat-card">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted">Offen</p>
            <p className="mt-3 text-3xl font-semibold">{openEvents}</p>
            <p className="mt-2 text-sm text-muted">Events mit erlaubten Anfragen</p>
          </div>
        </div>

        <div className="grid min-w-0 gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
          <div className="space-y-6">
            <BlockedDayForm />
            <ReservationEventForm />
          </div>

          <div className="space-y-6">
            <section className="glass-panel admin-panel p-4 sm:p-6">
              <div className="mb-5">
                <p className="eyebrow">Liste</p>
                <h3 className="mt-2 text-2xl font-semibold">Kommende Sperrtage</h3>
                <p className="mt-2 text-sm leading-6 text-muted">
                  Diese Einträge blockieren den kompletten Tag unabhängig von Uhrzeit und
                  Personenanzahl.
                </p>
              </div>

              {days.length ? (
                <div className="space-y-3">
                  {days.map((day) => (
                    <div
                      className="admin-list-card flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between"
                      key={day.id}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted">
                          {day.date}
                        </p>
                        <p className="mt-1 text-lg font-semibold">{formatDisplayDate(day.date)}</p>
                        <p className="mt-2 text-sm leading-6 text-muted">
                          {day.reason || "Ohne Begründung"}
                        </p>
                      </div>

                      <form action={deleteBlockedDayAction}>
                        <input name="id" type="hidden" value={day.id} />
                        <button className="secondary-action w-full sm:w-auto" type="submit">
                          Entfernen
                        </button>
                      </form>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="admin-message-preview text-sm leading-6 text-muted">
                  Keine kommenden Sperrtage eingetragen.
                </div>
              )}
            </section>

            <section className="glass-panel admin-panel p-4 sm:p-6">
              <div className="mb-5">
                <p className="eyebrow">Events</p>
                <h3 className="mt-2 text-2xl font-semibold">Musik- und Eventtage</h3>
                <p className="mt-2 text-sm leading-6 text-muted">
                  Eventtage können öffentliche Anfragen blockieren oder nur als Hinweis für Gäste
                  erscheinen.
                </p>
              </div>

              {events.length ? (
                <div className="space-y-3">
                  {events.map((event) => (
                    <div
                      className="admin-list-card flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:justify-between"
                      key={event.id}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted">
                            {formatDisplayDate(event.date)}
                          </p>
                          <span
                            className={`admin-filter-chip pointer-events-none px-3 py-1 text-xs ${
                              event.reservationsAllowed ? "text-success" : "text-danger"
                            }`}
                          >
                            {event.reservationsAllowed ? "Anfragen erlaubt" : "Blockiert"}
                          </span>
                        </div>
                        <p className="mt-2 text-lg font-semibold">{event.title}</p>
                        <p className="mt-1 text-sm leading-6 text-muted">
                          {event.publicNote || "Kein öffentlicher Hinweis hinterlegt."}
                        </p>
                      </div>

                      <form action={deleteReservationEventAction}>
                        <input name="id" type="hidden" value={event.id} />
                        <button className="secondary-action w-full sm:w-auto" type="submit">
                          Entfernen
                        </button>
                      </form>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="admin-message-preview text-sm leading-6 text-muted">
                  Keine Eventtage eingetragen.
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
