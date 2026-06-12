import { NextResponse } from "next/server";
import { z } from "zod";
import { isPublicHostRequest } from "@/src/server/host-guard";
import { checkRateLimit } from "@/src/server/rate-limit";
import { getClientRateLimitKey } from "@/src/server/request-security";
import { getReservationSlotsForDate } from "@/src/server/reservation-availability";
import { getSetupStatus } from "@/src/server/setup";

export const dynamic = "force-dynamic";

const reservationSlotsQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  guestCount: z.coerce.number().int().min(1).max(500).default(1),
});

export async function GET(request: Request) {
  if (!(await isPublicHostRequest())) {
    return NextResponse.json({ message: "Nicht verfügbar." }, { status: 404 });
  }

  const setupStatus = await getSetupStatus();

  if (!setupStatus.setupCompleted) {
    return NextResponse.json(
      { message: "Reservierungen sind noch nicht verfügbar." },
      { status: 503 },
    );
  }

  const rateLimitKey = await getClientRateLimitKey("reservation-slots");

  if (!checkRateLimit(rateLimitKey, 120, 15 * 60 * 1000)) {
    return NextResponse.json({ message: "Bitte später erneut versuchen." }, { status: 429 });
  }

  const url = new URL(request.url);
  const parsed = reservationSlotsQuerySchema.safeParse({
    date: url.searchParams.get("date"),
    guestCount: url.searchParams.get("guestCount") ?? "1",
  });

  if (!parsed.success) {
    return NextResponse.json({ message: "Ungültige Anfrage." }, { status: 400 });
  }

  const result = await getReservationSlotsForDate(parsed.data);

  return NextResponse.json(result, {
    headers: {
      "Cache-Control": "private, no-store",
    },
  });
}
