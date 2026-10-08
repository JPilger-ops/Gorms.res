import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { TablePlanWorkspace } from "@/components/table-plan/workspace";
import { requireVenuePermission } from "@/src/server/guards";
import { getTablePlan } from "@/src/server/table-plan";
import { TablePlanError } from "@/src/lib/table-plan-types";

export const dynamic = "force-dynamic";
export default async function AreaPlanPage({ params }: { params: Promise<{ areaId: string }> }) {
  const { venue, session } = await requireVenuePermission("table-plan:manage");
  let plan;
  try {
    plan = await getTablePlan(venue, (await params).areaId, session);
  } catch (error) {
    if (error instanceof TablePlanError && error.status === 404) notFound();
    throw error;
  }
  return (
    <AdminShell venue={venue} session={session}>
      <TablePlanWorkspace key={plan.area.id} initialPlan={plan} />
    </AdminShell>
  );
}
