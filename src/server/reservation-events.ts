import { and, desc, eq } from "drizzle-orm";
import { auditLog, reservationEvents } from "@/db/schema";
import type { CreateReservationEventInput } from "@/src/lib/reservation-events-validation";
import { db } from "@/src/server/db";
import type { AuthenticatedSession } from "@/src/server/guards";
import type { VenueContext } from "@/src/server/venues";

const defaultBlockingPublicNote =
  "An diesem Tag nehmen wir keine normalen Reservierungen an. Kommen Sie gern einfach vorbei.";

export async function listReservationEvents(venue: VenueContext) {
  return db.query.reservationEvents.findMany({
    where: eq(reservationEvents.venueId, venue.id),
    orderBy: [desc(reservationEvents.date), desc(reservationEvents.createdAt)],
  });
}

export async function listBlockingReservationEventsForDate(venue: VenueContext, date: string) {
  return db.query.reservationEvents.findMany({
    where: and(
      eq(reservationEvents.venueId, venue.id),
      eq(reservationEvents.date, date),
      eq(reservationEvents.reservationsAllowed, false),
    ),
  });
}

export async function createReservationEvent(
  venue: VenueContext,
  input: CreateReservationEventInput,
  session: AuthenticatedSession,
) {
  const publicNote =
    input.publicNote ?? (input.reservationsAllowed ? undefined : defaultBlockingPublicNote);

  const [event] = await db
    .insert(reservationEvents)
    .values({
      venueId: venue.id,
      createdByUserId: session.userId,
      date: input.date,
      publicNote,
      reservationsAllowed: input.reservationsAllowed,
      title: input.title,
    })
    .returning();

  await db.insert(auditLog).values({
    action: "reservation_event.create",
    venueId: venue.id,
    entityId: event.id,
    entityType: "reservation_event",
    metadata: {
      date: input.date,
      reservationsAllowed: input.reservationsAllowed,
    },
    userId: session.userId,
  });

  return event;
}

export async function deleteReservationEvent(
  venue: VenueContext,
  id: string,
  session: AuthenticatedSession,
) {
  const [deleted] = await db
    .delete(reservationEvents)
    .where(and(eq(reservationEvents.id, id), eq(reservationEvents.venueId, venue.id)))
    .returning({ id: reservationEvents.id });
  if (!deleted) return false;

  await db.insert(auditLog).values({
    action: "reservation_event.delete",
    venueId: venue.id,
    entityId: id,
    entityType: "reservation_event",
    metadata: {},
    userId: session.userId,
  });
  return true;
}
