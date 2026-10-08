import type { NextRequest } from "next/server";
import { requireTablePlanHttp, tablePlanHttpError } from "@/src/server/table-plan-http";
import { getTablePlan } from "@/src/server/table-plan";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ areaId: string }> },
) {
  try {
    const { venue, session } = await requireTablePlanHttp(request, false);
    return Response.json(
      { plan: await getTablePlan(venue, (await params).areaId, session) },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return tablePlanHttpError(error);
  }
}
