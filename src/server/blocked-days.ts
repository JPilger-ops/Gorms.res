import { and, asc, eq, gte } from "drizzle-orm";
import { auditLog, blockedDays } from "@/db/schema";
import type { CreateBlockedDayInput } from "@/src/lib/blocked-days-validation";
import { db } from "@/src/server/db";
import type { AuthenticatedSession } from "@/src/server/guards";
import type { VenueContext } from "@/src/server/venues";
import { todayInTimeZone } from "@/src/lib/dates";

export async function getBlockedDays(venue: VenueContext) {
  const today = todayInTimeZone(venue.timeZone);

  return db
    .select({
      createdAt: blockedDays.createdAt,
      date: blockedDays.date,
      id: blockedDays.id,
      reason: blockedDays.reason,
    })
    .from(blockedDays)
    .where(and(eq(blockedDays.venueId, venue.id), gte(blockedDays.date, today)))
    .orderBy(asc(blockedDays.date));
}

export async function createBlockedDay(
  venue: VenueContext,
  input: CreateBlockedDayInput,
  session: AuthenticatedSession,
) {
  const [blockedDay] = await db
    .insert(blockedDays)
    .values({
      venueId: venue.id,
      date: input.date,
      reason: input.reason,
    })
    .onConflictDoUpdate({
      target: [blockedDays.venueId, blockedDays.date],
      set: {
        reason: input.reason,
      },
    })
    .returning({ id: blockedDays.id });

  await db.insert(auditLog).values({
    userId: session.userId,
    action: "blocked_day.upsert",
    venueId: venue.id,
    entityType: "blocked_day",
    entityId: blockedDay.id,
    metadata: { date: input.date },
  });

  return blockedDay;
}

export async function deleteBlockedDay(
  venue: VenueContext,
  id: string,
  session: AuthenticatedSession,
) {
  const [deleted] = await db
    .delete(blockedDays)
    .where(and(eq(blockedDays.id, id), eq(blockedDays.venueId, venue.id)))
    .returning({
      date: blockedDays.date,
      id: blockedDays.id,
    });

  if (!deleted) {
    return false;
  }

  await db.insert(auditLog).values({
    userId: session.userId,
    action: "blocked_day.delete",
    venueId: venue.id,
    entityType: "blocked_day",
    entityId: deleted.id,
    metadata: { date: deleted.date },
  });

  return true;
}
