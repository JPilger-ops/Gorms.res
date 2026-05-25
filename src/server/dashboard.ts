import { asc, count, desc, eq, gte, sql } from "drizzle-orm";
import { blockedDays, reservationRequests } from "@/db/schema";
import { db } from "@/src/server/db";

export async function getAdminDashboardData() {
  const today = new Date().toISOString().slice(0, 10);

  const [pendingReservations, upcomingReservations, blockedDaysCount, recentReservations] =
    await Promise.all([
      db
        .select({ count: count() })
        .from(reservationRequests)
        .where(eq(reservationRequests.status, "pending")),
      db
        .select({ count: count() })
        .from(reservationRequests)
        .where(gte(reservationRequests.requestedDate, today)),
      db.select({ count: count() }).from(blockedDays).where(gte(blockedDays.date, today)),
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
        .orderBy(desc(reservationRequests.createdAt))
        .limit(5),
    ]);

  const nextBlockedDays = await db
    .select({
      date: blockedDays.date,
      reason: blockedDays.reason,
    })
    .from(blockedDays)
    .where(gte(blockedDays.date, today))
    .orderBy(asc(blockedDays.date))
    .limit(5);

  const reservationsByDate = await db
    .select({
      count: count(),
      requestedDate: reservationRequests.requestedDate,
    })
    .from(reservationRequests)
    .where(gte(reservationRequests.requestedDate, today))
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
