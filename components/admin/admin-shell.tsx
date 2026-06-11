import Link from "next/link";
import type { CSSProperties } from "react";
import { logoutAction } from "@/app/admin/actions";
import { getBrandingSettings } from "@/src/server/branding";
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

export async function AdminShell({
  children,
  session,
}: {
  children: React.ReactNode;
  session: AuthenticatedSession;
}) {
  const navItems = session.role === "admin" ? adminNav : employeeNav;
  const branding = await getBrandingSettings();

  return (
    <main
      className="app-shell"
      id="main-content"
      style={{ "--primary": branding.accentColor } as CSSProperties}
    >
      <div className="page-frame grid min-w-0 gap-4 py-4 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-6 lg:py-10">
        <aside className="glass-panel p-4 lg:sticky lg:top-6 lg:self-start">
          <div className="space-y-1 px-2 py-2">
            {branding.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                alt=""
                className="mb-4 max-h-16 w-auto max-w-full object-contain"
                src={branding.logoUrl}
              />
            ) : null}
            <p className="eyebrow">Backend</p>
            <h1 className="text-xl font-semibold">Heidekönig</h1>
            <p className="text-sm text-muted">{session.name}</p>
          </div>

          <nav
            className="mt-4 flex gap-2 overflow-x-auto pb-1 lg:grid lg:overflow-visible lg:pb-0"
            aria-label="Admin-Navigation"
          >
            {navItems.map((item) => (
              <Link
                className="shrink-0 whitespace-nowrap rounded-2xl border border-transparent bg-white/35 px-3 py-2 text-sm font-semibold text-muted shadow-[inset_0_1px_0_rgb(255_255_255_/_45%)] transition-colors hover:border-border hover:bg-surface-strong hover:text-foreground lg:whitespace-normal"
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

        <section className="min-w-0">{children}</section>
      </div>
    </main>
  );
}
