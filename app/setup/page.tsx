import { notFound, redirect } from "next/navigation";
import { SetupForm } from "@/app/setup/setup-form";
import { SystemCheckPanel } from "@/app/setup/system-check-panel";
import { isAdminHostRequest } from "@/src/server/host-guard";
import { getSetupStatus } from "@/src/server/setup";
import { runSetupSystemCheck } from "@/src/server/system-check";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  if (!(await isAdminHostRequest())) {
    notFound();
  }

  const status = await getSetupStatus();

  if (!status.canRunSetup) {
    redirect("/login");
  }

  const systemCheckGroups = await runSetupSystemCheck();

  return (
    <main className="app-shell">
      <section className="page-frame grid gap-8 py-8 lg:grid-cols-[0.82fr_1.18fr] lg:items-start lg:py-14">
        <div className="space-y-6 py-8 sm:py-14">
          <p className="eyebrow">Waldwirtschaft Heidekönig</p>
          <h2 className="max-w-2xl text-4xl font-semibold leading-[1.05] text-balance sm:text-6xl">
            Geschützte Ersteinrichtung
          </h2>
          <p className="max-w-xl text-lg leading-8 text-muted">
            Dieser Wizard erstellt genau den ersten Admin-User und deaktiviert sich danach
            dauerhaft.
          </p>
          <div className="glass-panel max-w-xl p-5 text-sm leading-6 text-muted">
            Setup ist nur über die Admin-Domain verfügbar. Der Token bleibt ausschließlich in der
            Server-Umgebung und wird nicht in der Datenbank gespeichert.
          </div>
        </div>

        <div className="space-y-6">
          <SystemCheckPanel groups={systemCheckGroups} />
          <SetupForm />
        </div>
      </section>
    </main>
  );
}
