const setupChecks = [
  "Docker-Deployment",
  "Datenbank-Migrationen",
  "Geschützter Setup-Wizard",
  "SMTP- und Reservierungseinstellungen",
];

export function SetupMaintenancePage() {
  return (
    <main className="app-shell flex items-center">
      <section className="page-frame grid gap-8 lg:grid-cols-[1fr_420px] lg:items-center">
        <div className="space-y-8 py-8 sm:py-14">
          <div className="space-y-5">
            <p className="eyebrow">Waldwirtschaft Heidekönig</p>
            <h1 className="max-w-3xl text-4xl font-semibold leading-[1.05] text-balance sm:text-6xl">
              Reservierungsanfragen werden vorbereitet.
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-muted sm:text-xl">
              Die Anwendung ist installiert, aber noch nicht fertig eingerichtet. Reservierungen
              können erst nach Abschluss des geschützten Setups angenommen werden.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <a className="primary-action" href="https://login.gorms.de/setup">
              Setup öffnen
            </a>
            <a className="secondary-action" href="https://login.gorms.de">
              Zum Login
            </a>
          </div>
        </div>

        <aside className="glass-panel p-5 sm:p-7" aria-label="Setup-Status">
          <div className="mb-6 flex items-center justify-between gap-4">
            <div>
              <p className="eyebrow">Status</p>
              <h2 className="mt-2 text-2xl font-semibold">Einrichtung offen</h2>
            </div>
            <span className="glass-control px-3 py-2 text-sm font-semibold text-warning">
              Wartung
            </span>
          </div>

          <div className="space-y-3">
            {setupChecks.map((label) => (
              <div
                className="flex items-center gap-3 rounded-2xl border border-border bg-surface/60 px-4 py-3"
                key={label}
              >
                <span className="size-2.5 rounded-full bg-warning" aria-hidden="true" />
                <span className="text-sm font-medium">{label}</span>
              </div>
            ))}
          </div>

          <p className="mt-6 text-sm leading-6 text-muted">
            Diese Seite ist ein Platzhalter bis der Setup-Wizard abgeschlossen ist.
          </p>
        </aside>
      </section>
    </main>
  );
}
