import Link from "next/link";
import { AdminShell } from "@/components/admin/admin-shell";
import { AreaForm } from "@/components/table-plan/area-form";
import { requireVenuePermission } from "@/src/server/guards";
import { listTablePlanAreas } from "@/src/server/table-plan";
import { adminUrl } from "@/src/lib/admin-urls";

export const dynamic = "force-dynamic";
export default async function TablePlanPage() {
  const { venue, session } = await requireVenuePermission("table-plan:manage");
  const areas = await listTablePlanAreas(venue, session);
  return (
    <AdminShell venue={venue} session={session}>
      <header className="mb-6">
        <p className="eyebrow">{venue.name}</p>
        <h2 className="mt-2 text-3xl font-semibold">Tischplan</h2>
      </header>
      <div className="grid gap-5">
        {areas.map((area) => (
          <article key={`${area.id}:${area.revision}`} className="glass-panel admin-panel p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-xl font-semibold">{area.name}</h3>
                <p className="mt-1 text-sm text-muted">
                  {area.archived ? "Archiviert" : area.isActive ? "Aktiv" : "Inaktiv"}
                </p>
              </div>
              <Link
                className="primary-action"
                href={adminUrl(`/admin/table-plan/${area.id}`, venue.id)}
              >
                Plan öffnen
              </Link>
            </div>
            <details className="mt-4">
              <summary className="cursor-pointer text-sm font-semibold">Bereich bearbeiten</summary>
              <div className="mt-4">
                <AreaForm area={area} />
              </div>
            </details>
          </article>
        ))}
        <section className="border-t border-border pt-5">
          <h3 className="mb-4 text-xl font-semibold">Neuer Bereich</h3>
          <AreaForm />
        </section>
      </div>
    </AdminShell>
  );
}
