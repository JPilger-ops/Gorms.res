import { hasPermission } from "@/src/lib/permissions";
import { isAdminHostRequest } from "@/src/server/host-guard";
import {
  getReservationIcsDownload,
  normalizeReservationIcsKind,
} from "@/src/server/reservation-ics";
import { getCurrentSession } from "@/src/server/sessions";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; kind: string }> },
) {
  if (!(await isAdminHostRequest())) {
    return new Response("Not found", { status: 404 });
  }

  const session = await getCurrentSession();

  if (!session || !hasPermission(session.role, "reservations:read")) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id, kind: rawKind } = await params;
  const kind = normalizeReservationIcsKind(rawKind);

  if (!kind) {
    return new Response("Not found", { status: 404 });
  }

  const download = await getReservationIcsDownload(id, kind);

  if (!download) {
    return new Response("Not found", { status: 404 });
  }

  return new Response(download.content, {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="${download.filename}"`,
      "Content-Type": "text/calendar; charset=utf-8",
    },
  });
}
