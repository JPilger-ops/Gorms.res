import { and, eq, inArray, isNotNull, lt, ne, or, sql } from "drizzle-orm";
import { auditLog, reservationOutgoingEmails, reservationRequests } from "@/db/schema";
import { db } from "@/src/server/db";
import type { AuthenticatedSession } from "@/src/server/guards";
import { getAdminSettings } from "@/src/server/settings";

const anonymizedEmail = "anonymisiert@invalid.local";
const anonymizedText = "[anonymisiert]";

export type RetentionCleanupResult = {
  auditLogCutoff: Date;
  auditLogsDeleted: number;
  auditLogsScrubbed: number;
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
    const oldReservations = await tx
      .select({ id: reservationRequests.id })
      .from(reservationRequests)
      .where(lt(reservationRequests.createdAt, reservationCutoff));
    const oldReservationIds = oldReservations.map((reservation) => reservation.id);

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
          oldReservationIds.length
            ? inArray(reservationRequests.id, oldReservationIds)
            : sql`false`,
          ne(reservationRequests.guestEmail, anonymizedEmail),
        ),
      )
      .returning({ id: reservationRequests.id });

    let outgoingEmailsAnonymized = 0;
    let auditLogsScrubbed = 0;

    if (oldReservationIds.length > 0) {
      const anonymizedEmails = await tx
        .update(reservationOutgoingEmails)
        .set({
          body: anonymizedText,
          recipient: anonymizedEmail,
          smtpError: null,
          subject: anonymizedText,
        })
        .where(
          and(
            inArray(reservationOutgoingEmails.reservationRequestId, oldReservationIds),
            or(
              ne(reservationOutgoingEmails.recipient, anonymizedEmail),
              ne(reservationOutgoingEmails.subject, anonymizedText),
              ne(reservationOutgoingEmails.body, anonymizedText),
              isNotNull(reservationOutgoingEmails.smtpError),
            ),
          ),
        )
        .returning({ id: reservationOutgoingEmails.id });

      outgoingEmailsAnonymized = anonymizedEmails.length;

      const scrubbedAuditLogs = await tx
        .update(auditLog)
        .set({
          metadata: {
            reservationRetentionDays: settings.reservationRetentionDays,
            retention: "reservation metadata scrubbed",
          },
        })
        .where(
          and(
            eq(auditLog.entityType, "reservation_request"),
            inArray(auditLog.entityId, oldReservationIds),
            sql`${auditLog.metadata}->>'retention' is distinct from 'reservation metadata scrubbed'`,
          ),
        )
        .returning({ id: auditLog.id });

      auditLogsScrubbed = scrubbedAuditLogs.length;
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
        auditLogsScrubbed,
        outgoingEmailsAnonymized,
        reservationRetentionDays: settings.reservationRetentionDays,
        reservationsAnonymized: anonymizedReservations.length,
      },
    });

    return {
      auditLogCutoff,
      auditLogsDeleted: deletedAuditLogs.length,
      auditLogsScrubbed,
      outgoingEmailsAnonymized,
      reservationCutoff,
      reservationsAnonymized: anonymizedReservations.length,
    };
  });
}
