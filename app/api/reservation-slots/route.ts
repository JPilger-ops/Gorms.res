import { NextResponse } from "next/server";
import { z } from "zod";
import { getPublicRequestVenue } from "@/src/server/host-guard";
import { checkRateLimit } from "@/src/server/rate-limit";
import { getClientRateLimitKey } from "@/src/server/request-security";
import { getReservationSlotsForDate } from "@/src/server/reservation-availability";
import { getSetupStatus } from "@/src/server/setup";

import { addCalendarDays, isIsoDate } from "@/src/lib/dates";
import { assertCapacityStrategy } from "@/src/server/venues";

export const dynamic = "force-dynamic";

const reservationSlotsQuerySchema = z.object({
  date: z.string().refine(isIsoDate),
  days: z.coerce.number().int().min(1).max(21).optional(),
  guestCount: z.coerce.number().int().min(1).max(500).default(1),
});

export async function GET(request: Request) {
  const venue = await getPublicRequestVenue();
  if (!venue) {
    return NextResponse.json({ message: "Nicht verfügbar." }, { status: 404 });
  }

  try {
    assertCapacityStrategy(venue);
  } catch {
    return NextResponse.json({ message: "Nicht verfügbar." }, { status: 503 });
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
    days: url.searchParams.get("days") ?? undefined,
    guestCount: url.searchParams.get("guestCount") ?? "1",
  });

  if (!parsed.success) {
    return NextResponse.json({ message: "Ungültige Anfrage." }, { status: 400 });
  }

  if (parsed.data.days) {
    const days = await Promise.all(
      Array.from({ length: parsed.data.days }, (_, index) => {
        return getReservationSlotsForDate(venue, {
          date: addCalendarDays(parsed.data.date, index),
          guestCount: parsed.data.guestCount,
        });
      }),
    );

    return NextResponse.json(
      { days },
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
      },
    );
  }

  const result = await getReservationSlotsForDate(venue, parsed.data);

  return NextResponse.json(result, {
    headers: {
      "Cache-Control": "private, no-store",
    },
  });
}
