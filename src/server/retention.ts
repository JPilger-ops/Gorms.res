import { and, inArray, lt, ne } from "drizzle-orm";
import { auditLog, reservationOutgoingEmails, reservationRequests } from "@/db/schema";
import { db } from "@/src/server/db";
import type { AuthenticatedSession } from "@/src/server/guards";
import { getAdminSettings } from "@/src/server/settings";

const anonymizedEmail = "anonymisiert@invalid.local";
const anonymizedText = "[anonymisiert]";

export type RetentionCleanupResult = {
  auditLogCutoff: Date;
  auditLogsDeleted: number;
  outgoingEmailsAnonymized: number;
  reservationCutoff: Date;
  reservationsAnonymized: number;
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
    const anonymizedReservations = await tx
      .update(reservationRequests)
      .set({
        guestEmail: anonymizedEmail,
        guestName: "Anonymisiert",
        guestPhone: anonymizedText,
        message: null,
        updatedAt: now,
      })
      .where(
        and(
          lt(reservationRequests.createdAt, reservationCutoff),
          ne(reservationRequests.guestEmail, anonymizedEmail),
        ),
      )
      .returning({ id: reservationRequests.id });

    let outgoingEmailsAnonymized = 0;

    if (anonymizedReservations.length > 0) {
      const anonymizedReservationIds = anonymizedReservations.map((reservation) => reservation.id);
      const anonymizedEmails = await tx
        .update(reservationOutgoingEmails)
        .set({
          body: anonymizedText,
          recipient: anonymizedEmail,
          smtpError: null,
          subject: anonymizedText,
        })
        .where(inArray(reservationOutgoingEmails.reservationRequestId, anonymizedReservationIds))
        .returning({ id: reservationOutgoingEmails.id });

      outgoingEmailsAnonymized = anonymizedEmails.length;
    }

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
        outgoingEmailsAnonymized,
        reservationRetentionDays: settings.reservationRetentionDays,
        reservationsAnonymized: anonymizedReservations.length,
      },
    });

    return {
      auditLogCutoff,
      auditLogsDeleted: deletedAuditLogs.length,
      outgoingEmailsAnonymized,
      reservationCutoff,
      reservationsAnonymized: anonymizedReservations.length,
    };
  });
}
