import { asc, eq, gte } from "drizzle-orm";
import { auditLog, blockedDays } from "@/db/schema";
import type { CreateBlockedDayInput } from "@/src/lib/blocked-days-validation";
import { db } from "@/src/server/db";
import type { AuthenticatedSession } from "@/src/server/guards";

export async function getBlockedDays() {
  const today = new Date().toISOString().slice(0, 10);

  return db
    .select({
      createdAt: blockedDays.createdAt,
      date: blockedDays.date,
      id: blockedDays.id,
      reason: blockedDays.reason,
    })
    .from(blockedDays)
    .where(gte(blockedDays.date, today))
    .orderBy(asc(blockedDays.date));
}

export async function createBlockedDay(
  input: CreateBlockedDayInput,
  session: AuthenticatedSession,
) {
  const [blockedDay] = await db
    .insert(blockedDays)
    .values({
      date: input.date,
      reason: input.reason,
    })
    .onConflictDoUpdate({
      target: blockedDays.date,
      set: {
        reason: input.reason,
      },
    })
    .returning({ id: blockedDays.id });

  await db.insert(auditLog).values({
    userId: session.userId,
    action: "blocked_day.upsert",
    entityType: "blocked_day",
    entityId: blockedDay.id,
    metadata: { date: input.date },
  });

  return blockedDay;
}

export async function deleteBlockedDay(id: string, session: AuthenticatedSession) {
  const [deleted] = await db.delete(blockedDays).where(eq(blockedDays.id, id)).returning({
    date: blockedDays.date,
    id: blockedDays.id,
  });

  if (!deleted) {
    return false;
  }

  await db.insert(auditLog).values({
    userId: session.userId,
    action: "blocked_day.delete",
    entityType: "blocked_day",
    entityId: deleted.id,
    metadata: { date: deleted.date },
  });

  return true;
}
