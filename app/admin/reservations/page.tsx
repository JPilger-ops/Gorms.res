import Link from "next/link";
import { ReservationStatusForm } from "@/app/admin/reservations/reservation-status-form";
import { AdminShell } from "@/components/admin/admin-shell";
import { requirePermission } from "@/src/server/guards";
import {
  getAdminReservationRequests,
  normalizeReservationStatusFilter,
  type ReservationStatus,
  type ReservationStatusFilter,
} from "@/src/server/reservations";

export const dynamic = "force-dynamic";

const statusLabels: Record<ReservationStatusFilter, string> = {
  accepted: "Angenommen",
  all: "Alle",
  cancelled: "Storniert",
  declined: "Abgelehnt",
  pending: "Offen",
};

const statusClasses: Record<ReservationStatus, string> = {
  accepted: "border-success/35 bg-success/10 text-success",
  cancelled: "border-border bg-surface-strong/70 text-muted",
  declined: "border-danger/35 bg-danger/10 text-danger",
  pending: "border-warning/35 bg-warning/10 text-warning",
};

const filterItems: ReservationStatusFilter[] = [
  "all",
  "pending",
  "accepted",
  "declined",
  "cancelled",
];

function formatDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);

  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    weekday: "short",
    year: "numeric",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(value);
}

function statusCount(
  status: ReservationStatusFilter,
  countsByStatus: Record<ReservationStatus, number>,
  total: number,
) {
  return status === "all" ? total : countsByStatus[status];
}

export default async function ReservationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string | string[] }>;
}) {
  const session = await requirePermission("reservations:read");
  const canManageStatus = session.role === "admin";
  const status = normalizeReservationStatusFilter((await searchParams).status);
  const { countsByStatus, reservations, total } = await getAdminReservationRequests({ status });

  return (
    <AdminShell session={session}>
      <div className="space-y-6">
        <div className="glass-panel admin-hero p-5 sm:p-7">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="eyebrow">Reservierungsanfragen</p>
              <h2 className="mt-2 text-3xl font-semibold">Anfragen einsehen</h2>
            </div>
            <p className="max-w-xl text-sm leading-6 text-muted">
              Eingegangene Anfragen prüfen, öffnen und mit vorbereitetem Mailworkflow beantworten.
              Manuelle Statusänderungen bleiben ein Sonderfall.
            </p>
          </div>
        </div>

        <section className="glass-panel admin-panel p-4 sm:p-5">
          <div className="admin-filter-bar" aria-label="Statusfilter">
            {filterItems.map((item) => {
              const active = item === status;

              return (
                <Link
                  aria-current={active ? "page" : undefined}
                  className="admin-filter-chip"
                  data-active={active ? "true" : undefined}
                  href={
                    item === "all" ? "/admin/reservations" : `/admin/reservations?status=${item}`
                  }
                  key={item}
                >
                  {statusLabels[item]} · {statusCount(item, countsByStatus, total)}
                </Link>
              );
            })}
          </div>
        </section>

        {reservations.length ? (
          <section className="space-y-4">
            {reservations.map((reservation) => (
              <article
                className="glass-panel admin-reservation-card p-4 sm:p-6"
                key={reservation.id}
              >
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="text-2xl font-semibold">
                        <Link
                          className="break-words underline-offset-4 hover:underline"
                          href={`/admin/reservations/${reservation.id}`}
                        >
                          {reservation.guestName}
                        </Link>
                      </h3>
                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-bold ${statusClasses[reservation.status]}`}
                      >
                        {statusLabels[reservation.status]}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-muted">
                      Eingegangen am {formatDateTime(reservation.createdAt)}
                    </p>
                  </div>

                  <div className="admin-date-badge">
                    <p className="text-xs font-bold uppercase text-muted">Wunschtermin</p>
                    <p className="mt-1 font-semibold">{formatDate(reservation.requestedDate)}</p>
                    <p className="mt-1 text-sm text-muted">
                      {reservation.requestedTime.slice(0, 5)} Uhr · {reservation.guestCount}{" "}
                      Personen
                    </p>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  <div className="admin-list-card p-4">
                    <p className="text-xs font-bold uppercase text-muted">E-Mail</p>
                    <a
                      className="mt-1 block break-words font-semibold text-foreground underline-offset-4 hover:underline"
                      href={`mailto:${reservation.guestEmail}`}
                    >
                      {reservation.guestEmail}
                    </a>
                  </div>

                  <div className="admin-list-card p-4">
                    <p className="text-xs font-bold uppercase text-muted">Telefon</p>
                    <a
                      className="mt-1 block break-words font-semibold text-foreground underline-offset-4 hover:underline"
                      href={`tel:${reservation.guestPhone}`}
                    >
                      {reservation.guestPhone}
                    </a>
                  </div>
                </div>

                {reservation.message ? (
                  <div className="admin-message-preview mt-3">
                    <p className="text-xs font-bold uppercase text-muted">Nachricht</p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6">
                      {reservation.message}
                    </p>
                  </div>
                ) : null}

                <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <Link
                    className="primary-action inline-flex"
                    aria-label={`Details zu ${reservation.guestName} öffnen`}
                    href={`/admin/reservations/${reservation.id}`}
                  >
                    Anfrage bearbeiten
                  </Link>
                  <p className="text-sm leading-6 text-muted">
                    Zusage, Absage und Rückfrage erfolgen in der Detailansicht.
                  </p>
                </div>

                {canManageStatus ? (
                  <ReservationStatusForm id={reservation.id} status={reservation.status} />
                ) : null}
              </article>
            ))}
          </section>
        ) : (
          <section className="glass-panel p-6">
            <p className="eyebrow">Keine Treffer</p>
            <h3 className="mt-2 text-2xl font-semibold">Keine Reservierungsanfragen gefunden</h3>
            <p className="mt-3 max-w-xl text-sm leading-6 text-muted">
              Für den ausgewählten Status liegen aktuell keine Anfragen vor.
            </p>
          </section>
        )}
      </div>
    </AdminShell>
  );
}
