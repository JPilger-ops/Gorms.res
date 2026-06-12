import { and, desc, eq } from "drizzle-orm";
import { auditLog, reservationEvents } from "@/db/schema";
import { db } from "@/src/server/db";
import type { AuthenticatedSession } from "@/src/server/guards";

export type ReservationEventInput = {
  date: string;
  publicNote?: string;
  reservationsAllowed: boolean;
  title: string;
};

export async function listReservationEvents() {
  return db.query.reservationEvents.findMany({
    orderBy: [desc(reservationEvents.date), desc(reservationEvents.createdAt)],
  });
}

export async function listBlockingReservationEventsForDate(date: string) {
  return db.query.reservationEvents.findMany({
    where: and(eq(reservationEvents.date, date), eq(reservationEvents.reservationsAllowed, false)),
  });
}

export async function createReservationEvent(
  input: ReservationEventInput,
  session: AuthenticatedSession,
) {
  const [event] = await db
    .insert(reservationEvents)
    .values({
      createdByUserId: session.userId,
      date: input.date,
      publicNote: input.publicNote,
      reservationsAllowed: input.reservationsAllowed,
      title: input.title,
    })
    .returning();

  await db.insert(auditLog).values({
    action: "reservation_event.create",
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

export async function deleteReservationEvent(id: string, session: AuthenticatedSession) {
  await db.delete(reservationEvents).where(eq(reservationEvents.id, id));

  await db.insert(auditLog).values({
    action: "reservation_event.delete",
    entityId: id,
    entityType: "reservation_event",
    metadata: {},
    userId: session.userId,
  });
}
