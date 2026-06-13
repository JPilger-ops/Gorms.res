"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type AdminNavItem = {
  href: string;
  label: string;
};

function isActivePath(pathname: string, href: string) {
  if (href === "/admin") {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminNav({ items }: { items: AdminNavItem[] }) {
  const pathname = usePathname();
  const activeItem = items.find((item) => isActivePath(pathname, item.href)) ?? items[0];

  return (
    <>
      <details className="admin-mobile-menu mt-4 lg:hidden">
        <summary>
          <span>
            <span className="block text-xs font-bold uppercase text-muted">Aktueller Bereich</span>
            <span className="mt-1 block text-base font-semibold">{activeItem.label}</span>
          </span>
          <span aria-hidden="true" className="admin-mobile-menu-icon" />
        </summary>

        <nav className="mt-3 grid gap-2" aria-label="Mobile Admin-Navigation">
          {items.map((item) => {
            const active = isActivePath(pathname, item.href);

            return (
              <Link
                aria-current={active ? "page" : undefined}
                className="glass-nav-link text-sm font-semibold"
                data-active={active ? "true" : undefined}
                href={item.href}
                key={item.href}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </details>

      <nav className="mt-4 hidden gap-2 lg:grid" aria-label="Admin-Navigation">
        {items.map((item) => {
          const active = isActivePath(pathname, item.href);

          return (
            <Link
              aria-current={active ? "page" : undefined}
              className="glass-nav-link text-sm font-semibold lg:whitespace-normal"
              data-active={active ? "true" : undefined}
              href={item.href}
              key={item.href}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
