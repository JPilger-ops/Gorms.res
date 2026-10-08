import type { NextRequest } from "next/server";
import { requireTablePlanHttp, tablePlanHttpError } from "@/src/server/table-plan-http";
import { readFloorplan } from "@/src/server/floorplans";

export const runtime = "nodejs";
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ areaId: string }> },
) {
  try {
    const { venue } = await requireTablePlanHttp(request, false);
    const bytes = await readFloorplan(
      venue,
      (await params).areaId,
      request.nextUrl.searchParams.get("asset") ?? "",
    );
    return new Response(bytes, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return tablePlanHttpError(error);
  }
}
