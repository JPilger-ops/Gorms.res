import Link from "next/link";
import { logoutAction } from "@/app/admin/actions";
import type { AuthenticatedSession } from "@/src/server/guards";

const adminNav = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/reservations", label: "Reservierungsanfragen" },
  { href: "/admin/blocked-days", label: "Blockierte Tage" },
  { href: "/admin/opening-hours", label: "Öffnungszeiten" },
  { href: "/admin/settings", label: "Einstellungen" },
  { href: "/admin/users", label: "Benutzerverwaltung" },
  { href: "/admin/system", label: "System / Sicherheit" },
];

const employeeNav = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/reservations", label: "Reservierungsanfragen" },
  { href: "/admin/blocked-days", label: "Blockierte Tage" },
  { href: "/admin/opening-hours", label: "Öffnungszeiten" },
];

export function AdminShell({
  children,
  session,
}: {
  children: React.ReactNode;
  session: AuthenticatedSession;
}) {
  const navItems = session.role === "admin" ? adminNav : employeeNav;

  return (
    <main className="app-shell">
      <div className="page-frame grid gap-6 py-6 lg:grid-cols-[260px_1fr] lg:py-10">
        <aside className="glass-panel p-4 lg:sticky lg:top-6 lg:self-start">
          <div className="space-y-1 px-2 py-2">
            <p className="eyebrow">Backend</p>
            <h1 className="text-xl font-semibold">Heidekönig</h1>
            <p className="text-sm text-muted">{session.name}</p>
          </div>

          <nav className="mt-4 grid gap-1" aria-label="Admin-Navigation">
            {navItems.map((item) => (
              <Link
                className="rounded-2xl px-3 py-2 text-sm font-semibold text-muted transition-colors hover:bg-surface hover:text-foreground"
                href={item.href}
                key={item.href}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <form action={logoutAction} className="mt-5">
            <button className="secondary-action w-full" type="submit">
              Abmelden
            </button>
          </form>
        </aside>

        <section>{children}</section>
      </div>
    </main>
  );
}
