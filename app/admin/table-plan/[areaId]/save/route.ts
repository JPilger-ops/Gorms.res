import type { NextRequest } from "next/server";
import {
  readBoundedMultipart,
  requireTablePlanHttp,
  tablePlanHttpError,
} from "@/src/server/table-plan-http";
import { saveTablePlan } from "@/src/server/table-plan";
import { TablePlanError } from "@/src/lib/table-plan-types";

export const runtime = "nodejs";
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ areaId: string }> },
) {
  try {
    const { venue, session } = await requireTablePlanHttp(request, true);
    const { areaId } = await params;
    const data = await readBoundedMultipart(request);
    let value: unknown;
    try {
      value = JSON.parse(String(data.get("payload")));
    } catch {
      throw new TablePlanError(400, "Ungültige Plandaten.");
    }
    const file = data.get("floorplan");
    if (file && !(file instanceof File)) throw new TablePlanError(400, "Ungültiger Grundriss.");
    const plan = await saveTablePlan(
      venue,
      areaId,
      value,
      session,
      file instanceof File ? file : undefined,
    );
    return Response.json({ plan }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return tablePlanHttpError(error);
  }
}
