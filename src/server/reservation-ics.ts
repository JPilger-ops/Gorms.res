import { and, eq } from "drizzle-orm";
import { reservationRequests } from "@/db/schema";
import {
  createAcceptedReservationInternalIcs,
  createReservationRequestIcs,
  type CalendarReservationData,
} from "@/src/server/calendar";
import { db } from "@/src/server/db";
import { env } from "@/src/lib/env";
import { adminUrl } from "@/src/lib/admin-urls";
import { assertCapacityStrategy, type VenueContext } from "@/src/server/venues";

export const reservationIcsKinds = ["request", "accepted"] as const;

export type ReservationIcsKind = (typeof reservationIcsKinds)[number];

export type ReservationIcsDownload = {
  content: string;
  filename: string;
  kind: ReservationIcsKind;
};

export function buildAdminReservationUrl(venue: VenueContext, id: string) {
  return new URL(adminUrl(`/admin/reservations/${id}`, venue.id), env.ADMIN_APP_URL).toString();
}

export function normalizeReservationIcsKind(value: string): ReservationIcsKind | null {
  return reservationIcsKinds.includes(value as ReservationIcsKind)
    ? (value as ReservationIcsKind)
    : null;
}

function filenameFor(kind: ReservationIcsKind, date: string, time: string) {
  const prefix = kind === "accepted" ? "reservierung-bestaetigt" : "reservierungsanfrage";

  return `${prefix}-${date}-${time.replace(":", "")}.ics`;
}

function toCalendarReservationData(
  venue: VenueContext,
  reservation: typeof reservationRequests.$inferSelect,
): CalendarReservationData {
  return {
    adminUrl: buildAdminReservationUrl(venue, reservation.id),
    date: reservation.requestedDate,
    email: reservation.guestEmail,
    guestCount: reservation.guestCount,
    guestName: reservation.guestName,
    id: reservation.id,
    message: reservation.message,
    phone: reservation.guestPhone,
    time: reservation.requestedTime.slice(0, 5),
  };
}

export async function getReservationIcsDownload(
  venue: VenueContext,
  id: string,
  kind: ReservationIcsKind,
): Promise<ReservationIcsDownload | null> {
  assertCapacityStrategy(venue);
  const reservation = await db.query.reservationRequests.findFirst({
    where: and(eq(reservationRequests.id, id), eq(reservationRequests.venueId, venue.id)),
  });

  if (!reservation) {
    return null;
  }

  if (kind === "accepted" && reservation.status !== "accepted") {
    return null;
  }

  const calendarData = toCalendarReservationData(venue, reservation);
  const content =
    kind === "accepted"
      ? createAcceptedReservationInternalIcs(venue, calendarData)
      : createReservationRequestIcs(venue, calendarData);

  return {
    content,
    filename: filenameFor(kind, calendarData.date, calendarData.time),
    kind,
  };
}
