import { AdminShell } from "@/components/admin/admin-shell";
import { requirePermission } from "@/src/server/guards";
import { getAdminDashboardData } from "@/src/server/dashboard";

export const dynamic = "force-dynamic";

const statusLabels = {
  accepted: "Angenommen",
  cancelled: "Storniert",
  declined: "Abgelehnt",
  pending: "Offen",
};

const statusClasses = {
  accepted: "text-success",
  cancelled: "text-muted",
  declined: "text-danger",
  pending: "text-warning",
};

function formatDisplayDate(date: string) {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    weekday: "short",
  }).format(new Date(`${date}T00:00:00`));
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="admin-stat-card">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted">{label}</p>
      <p className="mt-3 text-4xl font-semibold">{value}</p>
    </div>
  );
}

export default async function AdminPage() {
  const session = await requirePermission("reservations:read");
  const dashboard = await getAdminDashboardData();

  return (
    <AdminShell session={session}>
      <div className="space-y-6">
        <div className="glass-panel admin-hero p-5 sm:p-7">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="eyebrow">Dashboard</p>
              <h2 className="mt-2 text-3xl font-semibold">Überblick</h2>
            </div>
            <p className="max-w-lg text-sm leading-6 text-muted">
              Schneller Überblick über offene Anfragen, kommende Reservierungsdaten und gesperrte
              Tage.
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Offene Anfragen" value={dashboard.pendingReservations} />
          <StatCard label="Kommende Anfragen" value={dashboard.upcomingReservations} />
          <StatCard label="Kommende Sperrtage" value={dashboard.blockedDaysCount} />
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
          <section className="glass-panel admin-panel p-5 sm:p-6">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <p className="eyebrow">Reservierungen</p>
                <h3 className="mt-2 text-2xl font-semibold">Neue Anfragen</h3>
                <p className="mt-2 text-sm leading-6 text-muted">
                  Die zuletzt eingegangenen Anfragen, unabhängig vom Reservierungsdatum.
                </p>
              </div>
            </div>

            {dashboard.recentReservations.length ? (
              <div className="space-y-3">
                {dashboard.recentReservations.map((reservation) => (
                  <div className="admin-list-card p-4" key={reservation.id}>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-semibold">{reservation.guestName}</p>
                        <p className="mt-1 text-sm text-muted">
                          {formatDisplayDate(reservation.requestedDate)} um{" "}
                          {reservation.requestedTime.slice(0, 5)} · {reservation.guestCount}{" "}
                          Personen
                        </p>
                      </div>
                      <span
                        className={`admin-filter-chip pointer-events-none w-fit px-3 py-1 text-xs ${
                          statusClasses[reservation.status]
                        }`}
                      >
                        {statusLabels[reservation.status]}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="admin-message-preview text-sm leading-6 text-muted">
                Noch keine Reservierungsanfragen vorhanden.
              </div>
            )}
          </section>

          <section className="space-y-6">
            <div className="glass-panel admin-panel p-5 sm:p-6">
              <p className="eyebrow">Auslastung</p>
              <h3 className="mt-2 text-2xl font-semibold">Nächste Tage</h3>
              <p className="mt-2 text-sm leading-6 text-muted">
                Reservierungsanfragen gruppiert nach Datum.
              </p>
              <div className="mt-5 space-y-3">
                {dashboard.reservationsByDate.length ? (
                  dashboard.reservationsByDate.map((item) => (
                    <div
                      className="admin-list-card flex items-center justify-between px-4 py-3"
                      key={item.requestedDate}
                    >
                      <span className="text-sm font-semibold">
                        {formatDisplayDate(item.requestedDate)}
                      </span>
                      <span className="text-sm text-muted">{item.count} Anfragen</span>
                    </div>
                  ))
                ) : (
                  <p className="admin-message-preview text-sm leading-6 text-muted">
                    Keine kommenden Anfragen.
                  </p>
                )}
              </div>
            </div>

            <div className="glass-panel admin-panel p-5 sm:p-6">
              <p className="eyebrow">Sperrtage</p>
              <h3 className="mt-2 text-2xl font-semibold">Nächste Sperren</h3>
              <p className="mt-2 text-sm leading-6 text-muted">
                Manuell gesperrte Tage, die Gäste nicht auswählen können.
              </p>
              <div className="mt-5 space-y-3">
                {dashboard.nextBlockedDays.length ? (
                  dashboard.nextBlockedDays.map((day) => (
                    <div className="admin-list-card px-4 py-3" key={day.date}>
                      <p className="text-sm font-semibold">{formatDisplayDate(day.date)}</p>
                      <p className="mt-1 text-sm text-muted">{day.reason || "Ohne Begründung"}</p>
                    </div>
                  ))
                ) : (
                  <p className="admin-message-preview text-sm leading-6 text-muted">
                    Keine kommenden Sperrtage.
                  </p>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
    </AdminShell>
  );
}
