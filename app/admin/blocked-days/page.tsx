import { AdminShell } from "@/components/admin/admin-shell";
import { deleteBlockedDayAction } from "@/app/admin/blocked-days/actions";
import { BlockedDayForm } from "@/app/admin/blocked-days/blocked-day-form";
import { getBlockedDays } from "@/src/server/blocked-days";
import { requirePermission } from "@/src/server/guards";

export const dynamic = "force-dynamic";

export default async function BlockedDaysPage() {
  const session = await requirePermission("blocked-days:manage");
  const days = await getBlockedDays();

  return (
    <AdminShell session={session}>
      <div className="space-y-6">
        <div className="glass-panel p-5 sm:p-7">
          <p className="eyebrow">Blockierte Tage</p>
          <h2 className="mt-2 text-3xl font-semibold">Sperrtage verwalten</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
            Diese Tage werden im öffentlichen Reservierungsformular serverseitig blockiert.
          </p>
        </div>

        <div className="grid min-w-0 gap-6 xl:grid-cols-[0.8fr_minmax(0,1.2fr)]">
          <BlockedDayForm />

          <section className="glass-panel p-4 sm:p-6">
            <div className="mb-5">
              <p className="eyebrow">Liste</p>
              <h3 className="mt-2 text-2xl font-semibold">Kommende Sperrtage</h3>
            </div>

            {days.length ? (
              <div className="space-y-3">
                {days.map((day) => (
                  <div
                    className="flex flex-col gap-3 rounded-2xl border border-border bg-surface/65 p-4 sm:flex-row sm:items-center sm:justify-between"
                    key={day.id}
                  >
                    <div className="min-w-0">
                      <p className="font-semibold">{day.date}</p>
                      <p className="mt-1 text-sm text-muted">{day.reason || "Ohne Begründung"}</p>
                    </div>

                    <form action={deleteBlockedDayAction}>
                      <input name="id" type="hidden" value={day.id} />
                      <button className="secondary-action" type="submit">
                        Entfernen
                      </button>
                    </form>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-border bg-surface/65 p-5 text-sm leading-6 text-muted">
                Keine kommenden Sperrtage eingetragen.
              </div>
            )}
          </section>
        </div>
      </div>
    </AdminShell>
  );
}
