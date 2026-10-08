import { and, asc, count, desc, eq, gte, sql } from "drizzle-orm";
import { blockedDays, reservationRequests } from "@/db/schema";
import { db } from "@/src/server/db";
import type { VenueContext } from "@/src/server/venues";
import { todayInTimeZone } from "@/src/lib/dates";

export async function getAdminDashboardData(venue: VenueContext) {
  const today = todayInTimeZone(venue.timeZone);

  const [pendingReservations, upcomingReservations, blockedDaysCount, recentReservations] =
    await Promise.all([
      db
        .select({ count: count() })
        .from(reservationRequests)
        .where(
          and(eq(reservationRequests.venueId, venue.id), eq(reservationRequests.status, "pending")),
        ),
      db
        .select({ count: count() })
        .from(reservationRequests)
        .where(
          and(
            eq(reservationRequests.venueId, venue.id),
            gte(reservationRequests.requestedDate, today),
          ),
        ),
      db
        .select({ count: count() })
        .from(blockedDays)
        .where(and(eq(blockedDays.venueId, venue.id), gte(blockedDays.date, today))),
      db
        .select({
          createdAt: reservationRequests.createdAt,
          guestCount: reservationRequests.guestCount,
          guestName: reservationRequests.guestName,
          id: reservationRequests.id,
          requestedDate: reservationRequests.requestedDate,
          requestedTime: reservationRequests.requestedTime,
          status: reservationRequests.status,
        })
        .from(reservationRequests)
        .where(eq(reservationRequests.venueId, venue.id))
        .orderBy(desc(reservationRequests.createdAt))
        .limit(5),
    ]);

  const nextBlockedDays = await db
    .select({
      date: blockedDays.date,
      reason: blockedDays.reason,
    })
    .from(blockedDays)
    .where(and(eq(blockedDays.venueId, venue.id), gte(blockedDays.date, today)))
    .orderBy(asc(blockedDays.date))
    .limit(5);

  const reservationsByDate = await db
    .select({
      count: count(),
      requestedDate: reservationRequests.requestedDate,
    })
    .from(reservationRequests)
    .where(
      and(eq(reservationRequests.venueId, venue.id), gte(reservationRequests.requestedDate, today)),
    )
    .groupBy(reservationRequests.requestedDate)
    .orderBy(sql`${reservationRequests.requestedDate} asc`)
    .limit(7);

  return {
    blockedDaysCount: blockedDaysCount[0]?.count ?? 0,
    nextBlockedDays,
    pendingReservations: pendingReservations[0]?.count ?? 0,
    recentReservations,
    reservationsByDate,
    upcomingReservations: upcomingReservations[0]?.count ?? 0,
  };
}
