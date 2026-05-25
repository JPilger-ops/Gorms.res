import { lt } from "drizzle-orm";
import { auditLog, reservationRequests } from "@/db/schema";
import { db } from "@/src/server/db";
import type { AuthenticatedSession } from "@/src/server/guards";
import { getAdminSettings } from "@/src/server/settings";

export type RetentionCleanupResult = {
  auditLogCutoff: Date;
  auditLogsDeleted: number;
  reservationCutoff: Date;
  reservationsDeleted: number;
};

function cutoffDate(retentionDays: number, now = new Date()) {
  return new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);
}

export async function runRetentionCleanup({
  now = new Date(),
  session,
}: {
  now?: Date;
  session?: AuthenticatedSession;
} = {}): Promise<RetentionCleanupResult> {
  const settings = await getAdminSettings();
  const reservationCutoff = cutoffDate(settings.reservationRetentionDays, now);
  const auditLogCutoff = cutoffDate(settings.auditLogRetentionDays, now);

  return db.transaction(async (tx) => {
    const deletedReservations = await tx
      .delete(reservationRequests)
      .where(lt(reservationRequests.createdAt, reservationCutoff))
      .returning({ id: reservationRequests.id });

    const deletedAuditLogs = await tx
      .delete(auditLog)
      .where(lt(auditLog.createdAt, auditLogCutoff))
      .returning({ id: auditLog.id });

    await tx.insert(auditLog).values({
      userId: session?.userId,
      action: "retention.cleanup",
      entityType: "system",
      entityId: "retention",
      metadata: {
        auditLogRetentionDays: settings.auditLogRetentionDays,
        auditLogsDeleted: deletedAuditLogs.length,
        reservationRetentionDays: settings.reservationRetentionDays,
        reservationsDeleted: deletedReservations.length,
      },
    });

    return {
      auditLogCutoff,
      auditLogsDeleted: deletedAuditLogs.length,
      reservationCutoff,
      reservationsDeleted: deletedReservations.length,
    };
  });
}
