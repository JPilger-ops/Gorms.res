import type { SystemCheckGroup, SystemCheckStatus } from "@/src/server/system-check";

const statusLabel: Record<SystemCheckStatus, string> = {
  ok: "OK",
  warning: "Warnung",
  error: "Fehler",
};

const statusClassName: Record<SystemCheckStatus, string> = {
  ok: "bg-success text-primary-foreground",
  warning: "bg-warning text-accent-foreground",
  error: "bg-danger text-primary-foreground",
};

export function SystemCheckPanel({ groups }: { groups: SystemCheckGroup[] }) {
  return (
    <section className="glass-panel space-y-5 p-5 sm:p-6" aria-labelledby="system-check-heading">
      <div className="space-y-2">
        <p className="eyebrow">Systemprüfung</p>
        <h3 id="system-check-heading" className="text-2xl font-semibold">
          Startklar prüfen
        </h3>
        <p className="text-sm leading-6 text-muted">
          Status ohne Ausgabe von Secrets oder Zugangsdaten.
        </p>
      </div>

      <div className="space-y-5">
        {groups.map((group) => (
          <div className="space-y-2" key={group.title}>
            <h4 className="text-sm font-semibold text-muted">{group.title}</h4>
            <div className="space-y-2">
              {group.items.map((item) => (
                <div
                  className="rounded-2xl border border-border bg-surface/65 px-4 py-3"
                  key={`${group.title}-${item.label}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold">{item.label}</p>
                      <p className="mt-1 text-sm leading-5 text-muted">{item.detail}</p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${statusClassName[item.status]}`}
                    >
                      {statusLabel[item.status]}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
