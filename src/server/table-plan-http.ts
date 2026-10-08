import type { NextRequest } from "next/server";
import { isAdminHostRequest } from "@/src/server/host-guard";
import { getCurrentSession } from "@/src/server/sessions";
import { getAdminVenueForSession } from "@/src/server/guards";
import { assertTablePlanAccess } from "@/src/server/table-plan";
import { TablePlanError } from "@/src/lib/table-plan-types";
import { checkRateLimit } from "@/src/server/rate-limit";

export async function requireTablePlanHttp(request: NextRequest, mutation: boolean) {
  if (!(await isAdminHostRequest())) throw new TablePlanError(404, "Nicht gefunden.");
  const session = await getCurrentSession();
  if (!session) throw new TablePlanError(401, "Bitte erneut anmelden.");
  const venue = await getAdminVenueForSession(session);
  if (!venue) throw new TablePlanError(404, "Betrieb nicht gefunden.");
  assertTablePlanAccess(venue, session);
  if (mutation) {
    const origin = request.headers.get("origin");
    const authority =
      request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ?? request.headers.get("host");
    const protocol =
      request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ??
      request.nextUrl.protocol.replace(":", "");
    let valid = false;
    try {
      valid = Boolean(
        origin &&
        authority &&
        new URL(origin).origin === new URL(`${protocol}://${authority}`).origin,
      );
    } catch {}
    if (!valid)
      throw new TablePlanError(
        403,
        "Die Anfrage konnte nicht geprüft werden. Bitte die Seite neu laden.",
      );
    if (!checkRateLimit(`table-plan:${session.userId}`, 20, 60_000))
      throw new TablePlanError(429, "Bitte kurz warten und erneut versuchen.");
  }
  return { venue, session };
}

export async function readBoundedMultipart(request: Request) {
  const max = 9 * 1024 * 1024;
  const length = request.headers.get("content-length");
  if (length && Number(length) > max) throw new TablePlanError(413, "Die Anfrage ist zu groß.");
  const type = request.headers.get("content-type");
  if (!type?.startsWith("multipart/form-data;"))
    throw new TablePlanError(400, "Ungültiges Anfrageformat.");
  const reader = request.body?.getReader();
  if (!reader) throw new TablePlanError(400, "Leere Anfrage.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > max) throw new TablePlanError(413, "Die Anfrage ist zu groß.");
      chunks.push(chunk.value);
    }
  } finally {
    await reader.cancel();
  }
  try {
    const data = await new Response(Buffer.concat(chunks), {
      headers: { "Content-Type": type },
    }).formData();
    const payload = data.get("payload");
    if (
      typeof payload !== "string" ||
      Buffer.byteLength(payload) > 512 * 1024 ||
      data.getAll("payload").length !== 1 ||
      data.getAll("floorplan").length > 1 ||
      Array.from(data.keys()).some((key) => key !== "payload" && key !== "floorplan")
    )
      throw new TablePlanError(400, "Ungültige Plandaten.");
    return data;
  } catch (error) {
    if (error instanceof TablePlanError) throw error;
    throw new TablePlanError(400, "Die Anfrage konnte nicht gelesen werden.");
  }
}

export function tablePlanHttpError(error: unknown) {
  if (error instanceof TablePlanError)
    return Response.json(
      { message: error.message },
      { status: error.status, headers: { "Cache-Control": "private, no-store" } },
    );
  return Response.json(
    { message: "Der Tischplan konnte nicht verarbeitet werden. Bitte erneut versuchen." },
    { status: 500, headers: { "Cache-Control": "private, no-store" } },
  );
}
