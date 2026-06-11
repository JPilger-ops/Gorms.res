import { AdminShell } from "@/components/admin/admin-shell";
import type { SystemCheckStatus } from "@/src/server/system-check";
import { requirePermission } from "@/src/server/guards";
import { getSystemSecurityOverview } from "@/src/server/system-status";

export const dynamic = "force-dynamic";

const checkLabels: Record<SystemCheckStatus, string> = {
  error: "Fehler",
  ok: "OK",
  warning: "Warnung",
};

const checkClasses: Record<SystemCheckStatus, string> = {
  error: "border-danger/35 bg-danger/10 text-danger",
  ok: "border-success/35 bg-success/10 text-success",
  warning: "border-warning/35 bg-warning/10 text-warning",
};

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(value);
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface/65 p-4">
      <p className="text-xs font-bold uppercase text-muted">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}

export default async function SystemPage() {
  const session = await requirePermission("system:read");
  const overview = await getSystemSecurityOverview();

  return (
    <AdminShell session={session}>
      <div className="space-y-6">
        <div className="glass-panel p-5 sm:p-7">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="eyebrow">System / Sicherheit</p>
              <h2 className="mt-2 text-3xl font-semibold">Betriebsstatus</h2>
            </div>
            <p className="max-w-xl text-sm leading-6 text-muted">
              Kontrollseite für Host-Routing, Secrets, Datenbank, Uploads und sicherheitsrelevante
              Ereignisse. Secrets und personenbezogene Reservierungsdetails werden hier nicht
              angezeigt.
            </p>
          </div>
        </div>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Datenbank" value={overview.databaseOk ? "Verbunden" : "Fehler"} />
          <StatCard label="Aktive Sessions" value={overview.stats.activeSessions} />
          <StatCard label="Offene Anfragen" value={overview.stats.pendingReservations} />
          <StatCard label="Geheime Settings" value={overview.stats.secretSettings} />
        </section>

        <section className="glass-panel p-5 sm:p-6">
          <p className="eyebrow">Sicherheitsstatus</p>
          <h3 className="mt-2 text-2xl font-semibold">Konfiguration</h3>
          <div className="mt-5 grid gap-3 lg:grid-cols-2">
            <div className="rounded-2xl border border-border bg-surface/65 p-4">
              <p className="text-xs font-bold uppercase text-muted">Public Hosts</p>
              <p className="mt-2 break-words text-sm leading-6">
                {overview.hostSecurity.publicAllowedHosts.join(", ")}
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-surface/65 p-4">
              <p className="text-xs font-bold uppercase text-muted">Admin Hosts</p>
              <p className="mt-2 break-words text-sm leading-6">
                {overview.hostSecurity.adminAllowedHosts.join(", ")}
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-surface/65 p-4">
              <p className="text-xs font-bold uppercase text-muted">Session-Cookie</p>
              <p className="mt-2 text-sm leading-6">{overview.hostSecurity.adminCookieName}</p>
              <p className="mt-1 text-sm leading-6 text-muted">
                Admin-Cookies bleiben host-only auf dem Admin-Host.
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-surface/65 p-4">
              <p className="text-xs font-bold uppercase text-muted">Secrets</p>
              <p className="mt-2 text-sm leading-6">
                Encryption-Key: {overview.secrets.appEncryptionKeySource}
              </p>
              <p className="text-sm leading-6 text-muted">
                Session-Secret: {overview.secrets.sessionSecretSet ? "gesetzt" : "fehlt"} ·
                Setup-Token: {overview.secrets.setupTokenSet ? "gesetzt" : "fehlt"}
              </p>
            </div>
          </div>
        </section>

        <section className="glass-panel p-5 sm:p-6">
          <p className="eyebrow">Systemprüfung</p>
          <h3 className="mt-2 text-2xl font-semibold">Checks</h3>
          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            {overview.systemChecks.map((group) => (
              <div className="rounded-2xl border border-border bg-surface/65 p-4" key={group.title}>
                <h4 className="font-semibold">{group.title}</h4>
                <div className="mt-4 space-y-3">
                  {group.items.map((item) => (
                    <div className="rounded-xl border border-border bg-background/50 p-3" key={item.label}>
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold">{item.label}</p>
                        <span
                          className={`rounded-full border px-2.5 py-1 text-xs font-bold ${checkClasses[item.status]}`}
                        >
                          {checkLabels[item.status]}
                        </span>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-muted">{item.detail}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
          <div className="glass-panel p-5 sm:p-6">
            <p className="eyebrow">Betrieb</p>
            <h3 className="mt-2 text-2xl font-semibold">Kennzahlen</h3>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <StatCard label="Benutzer gesamt" value={overview.stats.totalUsers} />
              <StatCard label="Aktive Benutzer" value={overview.stats.activeUsers} />
              <StatCard label="Aktive Admins" value={overview.stats.activeAdmins} />
              <StatCard label="Anfragen gesamt" value={overview.stats.totalReservations} />
              <StatCard label="Anfragen löschen nach" value={`${overview.reservationRetentionDays} Tage`} />
              <StatCard label="Audit löschen nach" value={`${overview.auditRetentionDays} Tage`} />
            </div>
          </div>

          <div className="glass-panel p-5 sm:p-6">
            <p className="eyebrow">Audit Log</p>
            <h3 className="mt-2 text-2xl font-semibold">Letzte Ereignisse</h3>
            <div className="event-list mt-5 space-y-3">
              {overview.recentAuditEvents.length ? (
                overview.recentAuditEvents.map((event) => (
                  <div
                    className="event-card"
                    key={`${event.action}-${event.createdAt.toISOString()}`}
                  >
                    <div className="flex gap-3">
                      <span aria-hidden="true" className="event-marker mt-1.5" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="event-action">{event.action}</p>
                            <p className="event-meta mt-1">
                              {event.entityType} · {event.userName ?? "System"}
                            </p>
                          </div>
                          <p className="event-meta">{formatDateTime(event.createdAt)}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="rounded-2xl border border-border bg-surface/65 p-4 text-sm text-muted">
                  Noch keine Audit-Ereignisse vorhanden.
                </p>
              )}
            </div>
          </div>
        </section>
      </div>
    </AdminShell>
  );
}
