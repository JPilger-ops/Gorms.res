import { eq } from "drizzle-orm";
import { reservationRequests } from "@/db/schema";
import { db } from "@/src/server/db";
import { getAvailabilityCheckForReservation } from "@/src/server/reservation-availability";
import { listOutgoingEmailsForReservation } from "@/src/server/reservation-outgoing-emails";

export async function getAdminReservationDetail(id: string) {
  const reservation = await db.query.reservationRequests.findFirst({
    where: eq(reservationRequests.id, id),
  });

  if (!reservation) {
    return null;
  }

  const [availabilityCheck, outgoingEmails] = await Promise.all([
    getAvailabilityCheckForReservation(id),
    listOutgoingEmailsForReservation(id),
  ]);

  return {
    availabilityCheck,
    outgoingEmails,
    reservation,
  };
}
