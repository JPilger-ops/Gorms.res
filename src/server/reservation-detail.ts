import { and, eq } from "drizzle-orm";
import { reservationRequests } from "@/db/schema";
import { db } from "@/src/server/db";
import { getAvailabilityCheckForReservation } from "@/src/server/reservation-availability";
import { listOutgoingEmailsForReservation } from "@/src/server/reservation-outgoing-emails";
import type { VenueContext } from "@/src/server/venues";

export async function getAdminReservationDetail(venue: VenueContext, id: string) {
  const reservation = await db.query.reservationRequests.findFirst({
    where: and(eq(reservationRequests.id, id), eq(reservationRequests.venueId, venue.id)),
  });

  if (!reservation) {
    return null;
  }

  const [availabilityCheck, outgoingEmails] = await Promise.all([
    getAvailabilityCheckForReservation(venue, id),
    listOutgoingEmailsForReservation(venue, id),
  ]);

  return {
    availabilityCheck,
    outgoingEmails,
    reservation,
  };
}
