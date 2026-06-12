import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ReservationDecisionForm,
  type ReservationDecisionDraft,
} from "@/app/admin/reservations/[id]/decision-form";
import { AdminShell } from "@/components/admin/admin-shell";
import { hasPermission } from "@/src/lib/permissions";
import { getAiAssistantStatus } from "@/src/server/ai/config";
import { requirePermission } from "@/src/server/guards";
import { buildReservationDecisionDraft } from "@/src/server/reservation-decisions";
import { getAdminReservationDetail } from "@/src/server/reservation-detail";
import type { AvailabilityStatus } from "@/src/server/reservation-availability";
import type { ReservationStatus } from "@/src/server/reservations";

export const dynamic = "force-dynamic";

const reservationStatusLabels: Record<ReservationStatus, string> = {
  accepted: "Angenommen",
  cancelled: "Storniert",
  declined: "Abgelehnt",
  pending: "Offen",
};

const availabilityStatusLabels: Record<AvailabilityStatus, string> = {
  blocked: "Blockiert",
  bookable: "Buchbar",
  capacity_warning: "Kapazitätswarnung",
  manual_review: "Manuelle Prüfung",
};

const statusClasses: Record<ReservationStatus | AvailabilityStatus, string> = {
  accepted: "text-success",
  blocked: "text-danger",
  bookable: "text-success",
  cancelled: "text-muted",
  capacity_warning: "text-warning",
  declined: "text-danger",
  manual_review: "text-warning",
  pending: "text-warning",
};

const emailTypeLabels: Record<string, string> = {
  guest_acceptance: "Gast-Zusage",
  guest_decline: "Gast-Absage",
  guest_question: "Gast-Rückfrage",
  guest_receipt: "Gast-Eingangsbestätigung",
  staff_acceptance_notification: "Interne Zusage",
  staff_notification: "Interne Anfrage",
};

function formatDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);

  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "full",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function formatDateTime(value: Date | null) {
  if (!value) {
    return "Noch nicht gesendet";
  }

  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

function DetailCard({
  children,
  eyebrow,
  title,
}: {
  children: React.ReactNode;
  eyebrow?: string;
  title: string;
}) {
  return (
    <section className="glass-panel p-4 sm:p-6">
      {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
      <h3 className="mt-1 text-2xl font-semibold">{title}</h3>
      <div className="mt-4 min-w-0 space-y-4">{children}</div>
    </section>
  );
}

function DataTile({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-surface/65 p-4">
      <p className="text-xs font-bold uppercase text-muted">{label}</p>
      <div className="mt-1 min-w-0 break-words font-semibold">{value}</div>
    </div>
  );
}

function ListBlock({ items, title }: { items: string[]; title: string }) {
  if (!items.length) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-border bg-surface/65 p-4">
      <p className="text-xs font-bold uppercase text-muted">{title}</p>
      <ul className="mt-3 space-y-2 text-sm leading-6">
        {items.map((item) => (
          <li className="flex gap-2" key={item}>
            <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function IcsDownloadTile({
  description,
  disabledReason,
  href,
  title,
}: {
  description: string;
  disabledReason?: string;
  href?: string;
  title: string;
}) {
  return (
    <article className="rounded-2xl border border-border bg-surface/65 p-4">
      <div>
        <p className="text-sm font-bold">{title}</p>
        <p className="mt-2 text-sm leading-6 text-muted">{description}</p>
      </div>
      <div className="mt-4">
        {href ? (
          <a className="secondary-action inline-flex w-full justify-center" href={href}>
            ICS herunterladen
          </a>
        ) : (
          <span aria-disabled="true" className="secondary-action inline-flex w-full justify-center">
            {disabledReason ?? "Nicht verfügbar"}
          </span>
        )}
      </div>
    </article>
  );
}

function DisabledAiAction({ label }: { label: string }) {
  return (
    <span
      aria-disabled="true"
      className="secondary-action inline-flex min-h-12 w-full items-center justify-center text-center"
    >
      {label}
    </span>
  );
}

export default async function ReservationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requirePermission("reservations:read");
  const { id } = await params;
  const detail = await getAdminReservationDetail(id);

  if (!detail) {
    notFound();
  }

  const aiStatus = getAiAssistantStatus();
  const { availabilityCheck, outgoingEmails, reservation } = detail;
  const canRespond = hasPermission(session.role, "reservations:respond");
  const decisionDrafts: ReservationDecisionDraft[] = [
    {
      decision: "accept",
      ...buildReservationDecisionDraft("accept", reservation),
    },
    {
      decision: "decline",
      ...buildReservationDecisionDraft("decline", reservation),
    },
    {
      decision: "question",
      ...buildReservationDecisionDraft("question", reservation),
    },
  ];

  return (
    <AdminShell session={session}>
      <div className="space-y-6">
        <div className="glass-panel p-5 sm:p-7">
          <Link
            className="text-sm font-semibold text-muted hover:text-foreground"
            href="/admin/reservations"
          >
            Zurück zu den Anfragen
          </Link>
          <div className="mt-5 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="eyebrow">Reservierungsdetail</p>
              <h2 className="mt-2 text-3xl font-semibold">{reservation.guestName}</h2>
              <p className="mt-2 text-sm leading-6 text-muted">
                Eingegangen am {formatDateTime(reservation.createdAt)}
              </p>
            </div>
            <span
              className={`w-fit rounded-full border border-border bg-surface/70 px-4 py-2 text-sm font-bold ${statusClasses[reservation.status]}`}
            >
              {reservationStatusLabels[reservation.status]}
            </span>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
          <DetailCard eyebrow="Anfrage" title="Reservierungsdaten">
            <div className="grid gap-3 md:grid-cols-2">
              <DataTile label="Datum" value={formatDate(reservation.requestedDate)} />
              <DataTile label="Uhrzeit" value={`${reservation.requestedTime.slice(0, 5)} Uhr`} />
              <DataTile label="Personen" value={reservation.guestCount} />
              <DataTile
                label="Datenschutz bestätigt"
                value={formatDateTime(reservation.privacyAcknowledgedAt)}
              />
            </div>

            {reservation.message ? (
              <div className="rounded-2xl border border-border bg-surface/65 p-4">
                <p className="text-xs font-bold uppercase text-muted">Nachricht</p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{reservation.message}</p>
              </div>
            ) : (
              <p className="rounded-2xl border border-border bg-surface/65 p-4 text-sm text-muted">
                Keine optionale Nachricht angegeben.
              </p>
            )}
          </DetailCard>

          <DetailCard eyebrow="Kontakt" title="Gast">
            <div className="grid gap-3">
              <DataTile label="Name" value={reservation.guestName} />
              <DataTile
                label="E-Mail"
                value={
                  <a
                    className="underline-offset-4 hover:underline"
                    href={`mailto:${reservation.guestEmail}`}
                  >
                    {reservation.guestEmail}
                  </a>
                }
              />
              <DataTile
                label="Telefon"
                value={
                  <a
                    className="underline-offset-4 hover:underline"
                    href={`tel:${reservation.guestPhone}`}
                  >
                    {reservation.guestPhone}
                  </a>
                }
              />
            </div>
          </DetailCard>
        </div>

        <DetailCard eyebrow="Gorms.res Prüfung" title="Availability Snapshot">
          {availabilityCheck ? (
            <>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <DataTile
                  label="Prüfstatus"
                  value={
                    <span className={statusClasses[availabilityCheck.status]}>
                      {availabilityStatusLabels[availabilityCheck.status]}
                    </span>
                  }
                />
                <DataTile
                  label="Saison"
                  value={availabilityCheck.season === "summer" ? "Sommer" : "Winter"}
                />
                <DataTile
                  label="Zeitfenster"
                  value={`${availabilityCheck.windowStart.slice(0, 5)} - ${availabilityCheck.windowEnd.slice(0, 5)} Uhr`}
                />
                <DataTile
                  label="Späteste Anfrage"
                  value={`${availabilityCheck.latestReservationTime.slice(0, 5)} Uhr`}
                />
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <DataTile
                  label="Bestätigte Gäste im Fenster"
                  value={availabilityCheck.acceptedGuestsInWindow}
                />
                <DataTile
                  label="Offene Gäste im Fenster"
                  value={availabilityCheck.pendingGuestsInWindow}
                />
                <DataTile
                  label="Kapazität"
                  value={`${availabilityCheck.requestedGuestCount} angefragt / ${availabilityCheck.capacity} Plätze`}
                />
              </div>

              <div className="grid gap-3 lg:grid-cols-3">
                <ListBlock items={availabilityCheck.reasons} title="Blocker" />
                <ListBlock items={availabilityCheck.warnings} title="Warnungen" />
                <ListBlock items={availabilityCheck.manualReviewReasons} title="Manuelle Prüfung" />
              </div>

              {!availabilityCheck.reasons.length &&
              !availabilityCheck.warnings.length &&
              !availabilityCheck.manualReviewReasons.length ? (
                <p className="rounded-2xl border border-border bg-surface/65 p-4 text-sm text-muted">
                  Für diese Anfrage wurden keine Blocker, Warnungen oder Prüfgründe gespeichert.
                </p>
              ) : null}
            </>
          ) : (
            <p className="rounded-2xl border border-border bg-surface/65 p-4 text-sm text-muted">
              Für diese Anfrage liegt noch kein Availability-Snapshot vor. Das betrifft ältere
              Anfragen vor Version 1.1.
            </p>
          )}
        </DetailCard>

        <DetailCard eyebrow="Kalender" title="Interne ICS-Dateien">
          <p className="rounded-2xl border border-border bg-surface/65 p-4 text-sm leading-6 text-muted">
            Diese Kalenderdateien sind für die interne Bearbeitung gedacht und enthalten
            Kontaktdaten des Gasts. Nicht öffentlich teilen.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <IcsDownloadTile
              description="Enthält die ursprüngliche Anfrage mit Status offen und Admin-Link."
              href={`/admin/reservations/${reservation.id}/ics/request`}
              title="Anfrage-ICS"
            />
            <IcsDownloadTile
              description="Enthält die angenommene Reservierung mit bestätigtem Kalenderstatus."
              disabledReason="Erst nach Zusage verfügbar"
              href={
                reservation.status === "accepted"
                  ? `/admin/reservations/${reservation.id}/ics/accepted`
                  : undefined
              }
              title="Bestätigungs-ICS"
            />
          </div>
        </DetailCard>

        <DetailCard eyebrow="KI-Assistenz" title="Lokale Assistenz vorbereitet">
          <p className="rounded-2xl border border-border bg-surface/65 p-4 text-sm leading-6 text-muted">
            {aiStatus.uiMessage} KI darf keine Zusage, Absage, Rückfrage, E-Mail, ICS-Datei oder
            Statusänderung automatisch auslösen. Erzeugte Texte werden nur als editierbare Vorlage
            in die Antwortfelder eingefügt.
          </p>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <DisabledAiAction label="Anfrage zusammenfassen" />
            <DisabledAiAction
              label={aiStatus.enabled ? "Zusage im Antwortbereich" : "Zusage entwerfen"}
            />
            <DisabledAiAction
              label={aiStatus.enabled ? "Absage im Antwortbereich" : "Absage entwerfen"}
            />
            <DisabledAiAction
              label={aiStatus.enabled ? "Rückfrage im Antwortbereich" : "Rückfrage entwerfen"}
            />
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <DataTile label="Status" value={aiStatus.statusLabel} />
            <DataTile label="Geplantes Modell" value={aiStatus.model} />
            <DataTile label="Timeout" value={`${aiStatus.timeoutMs} ms`} />
          </div>
        </DetailCard>

        <DetailCard eyebrow="Antwort" title="Entscheidung senden">
          {canRespond && reservation.status === "pending" ? (
            <>
              <p className="rounded-2xl border border-border bg-surface/65 p-4 text-sm leading-6 text-muted">
                Zusage und Absage ändern den Status erst nach erfolgreichem SMTP-Versand. Rückfragen
                werden protokolliert, der Status bleibt offen.
              </p>
              <div className="grid gap-4 xl:grid-cols-3">
                {decisionDrafts.map((draft) => (
                  <ReservationDecisionForm
                    aiEnabled={aiStatus.enabled}
                    draft={draft}
                    expectedStatus={reservation.status}
                    key={draft.decision}
                    reservationId={reservation.id}
                  />
                ))}
              </div>
            </>
          ) : (
            <p className="rounded-2xl border border-border bg-surface/65 p-4 text-sm leading-6 text-muted">
              Für diese Anfrage ist der normale Antwortworkflow aktuell nicht verfügbar. Bereits
              entschiedene Anfragen können später über einen kontrollierten Sonderfallprozess
              angepasst werden.
            </p>
          )}
        </DetailCard>

        <DetailCard eyebrow="Kommunikation" title="Mailhistorie">
          {outgoingEmails.length ? (
            <div className="space-y-3">
              {outgoingEmails.map((email) => (
                <article
                  className="rounded-2xl border border-border bg-surface/65 p-4"
                  key={email.id}
                >
                  <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="text-sm font-bold">
                        {emailTypeLabels[email.type] ?? email.type}
                      </p>
                      <p className="mt-1 text-sm text-muted">{email.subject}</p>
                    </div>
                    <span
                      className={`w-fit rounded-full border border-border bg-surface/70 px-3 py-1 text-xs font-bold ${
                        email.smtpStatus === "sent" ? "text-success" : "text-danger"
                      }`}
                    >
                      {email.smtpStatus === "sent" ? "Gesendet" : "Fehlgeschlagen"}
                    </span>
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <DataTile label="Empfänger" value={email.recipient} />
                    <DataTile label="Zeitpunkt" value={formatDateTime(email.sentAt)} />
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="rounded-2xl border border-border bg-surface/65 p-4 text-sm text-muted">
              Für diese Anfrage wurde noch keine ausgehende E-Mail im neuen Workflow protokolliert.
            </p>
          )}
        </DetailCard>
      </div>
    </AdminShell>
  );
}
