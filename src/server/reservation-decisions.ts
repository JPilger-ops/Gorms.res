import { and, eq } from "drizzle-orm";
import { auditLog, reservationRequests } from "@/db/schema";
import type {
  ReservationDecisionInput,
  ReservationDecisionType,
} from "@/src/lib/reservation-decision-validation";
import { db } from "@/src/server/db";
import {
  buildInternalReservationAcceptedEmailContent,
  sendGuestReservationDecisionEmail,
  sendInternalReservationAcceptedEmail,
} from "@/src/server/email";
import type { AuthenticatedSession } from "@/src/server/guards";
import { buildAdminReservationUrl } from "@/src/server/reservation-ics";
import { recordReservationOutgoingEmail } from "@/src/server/reservation-outgoing-emails";
import type { ReservationStatus } from "@/src/server/reservations";
import { getEmailTemplateSettings } from "@/src/server/settings";

type DecisionDraftReservation = {
  guestCount: number;
  guestEmail: string;
  guestName: string;
  guestPhone: string;
  id: string;
  message: string | null;
  requestedDate: string;
  requestedTime: string;
  status: ReservationStatus;
};

const decisionConfig: Record<
  ReservationDecisionType,
  {
    auditAction: string;
    emailType: "guest_acceptance" | "guest_decline" | "guest_question";
    successMessage: string;
    targetStatus?: ReservationStatus;
  }
> = {
  accept: {
    auditAction: "reservation.decision_accept",
    emailType: "guest_acceptance",
    successMessage: "Zusage wurde gesendet und der Status wurde auf angenommen gesetzt.",
    targetStatus: "accepted",
  },
  decline: {
    auditAction: "reservation.decision_decline",
    emailType: "guest_decline",
    successMessage: "Absage wurde gesendet und der Status wurde auf abgelehnt gesetzt.",
    targetStatus: "declined",
  },
  question: {
    auditAction: "reservation.decision_question",
    emailType: "guest_question",
    successMessage: "Rückfrage wurde gesendet. Der Status bleibt offen.",
  },
};

function formatDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);

  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "long",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function reservationSummary(reservation: DecisionDraftReservation) {
  return `${formatDate(reservation.requestedDate)} um ${reservation.requestedTime.slice(0, 5)} Uhr für ${reservation.guestCount} Personen`;
}

function sanitizeSmtpError() {
  return "SMTP-Versand fehlgeschlagen.";
}

function toInternalReservationEmailData(
  reservation: DecisionDraftReservation,
  session: AuthenticatedSession,
) {
  return {
    acceptedByName: session.name,
    adminUrl: buildAdminReservationUrl(reservation.id),
    date: reservation.requestedDate,
    email: reservation.guestEmail,
    guestCount: reservation.guestCount,
    guestName: reservation.guestName,
    id: reservation.id,
    message: reservation.message ?? undefined,
    phone: reservation.guestPhone,
    time: reservation.requestedTime.slice(0, 5),
  };
}

async function sendInternalAcceptanceNotification(
  reservation: DecisionDraftReservation,
  session: AuthenticatedSession,
) {
  const templates = await getEmailTemplateSettings();
  const emailData = toInternalReservationEmailData(reservation, session);
  const internalEmail = buildInternalReservationAcceptedEmailContent(
    emailData,
    templates.reservationNotificationEmail,
  );

  try {
    await sendInternalReservationAcceptedEmail(emailData, internalEmail);
  } catch {
    await recordReservationOutgoingEmail({
      body: internalEmail.text,
      recipient: internalEmail.recipient,
      reservationRequestId: reservation.id,
      sentByUserId: session.userId,
      smtpError: sanitizeSmtpError(),
      smtpStatus: "failed",
      subject: internalEmail.subject,
      type: "staff_acceptance_notification",
    });

    return false;
  }

  await recordReservationOutgoingEmail({
    body: internalEmail.text,
    recipient: internalEmail.recipient,
    reservationRequestId: reservation.id,
    sentAt: new Date(),
    sentByUserId: session.userId,
    smtpStatus: "sent",
    subject: internalEmail.subject,
    type: "staff_acceptance_notification",
  });

  return true;
}

export function buildReservationDecisionDraft(
  decision: ReservationDecisionType,
  reservation: DecisionDraftReservation,
) {
  const summary = reservationSummary(reservation);

  if (decision === "accept") {
    return {
      body: [
        `vielen Dank für Ihre Reservierungsanfrage.`,
        "",
        `Wir bestätigen Ihre Reservierung am ${summary}.`,
        "",
        "Falls sich an Ihrer Personenanzahl oder Ankunftszeit etwas ändert, geben Sie uns bitte kurz Bescheid.",
        "",
        "Mit freundlichen Grüßen",
        "Waldwirtschaft Heidekönig",
      ].join("\n"),
      subject: "Ihre Reservierung bei der Waldwirtschaft Heidekönig",
    };
  }

  if (decision === "decline") {
    return {
      body: [
        `vielen Dank für Ihre Reservierungsanfrage am ${summary}.`,
        "",
        "Leider können wir Ihre Anfrage für diesen Termin nicht bestätigen.",
        "",
        "Gerne können Sie uns für einen alternativen Termin erneut kontaktieren.",
        "",
        "Mit freundlichen Grüßen",
        "Waldwirtschaft Heidekönig",
      ].join("\n"),
      subject: "Ihre Reservierungsanfrage bei der Waldwirtschaft Heidekönig",
    };
  }

  return {
    body: [
      `vielen Dank für Ihre Reservierungsanfrage am ${summary}.`,
      "",
      "Für die weitere Bearbeitung haben wir noch eine kurze Rückfrage:",
      "",
      "[Bitte Rückfrage ergänzen]",
      "",
      "Wichtig: Ihre Reservierung ist erst nach unserer persönlichen Bestätigung gültig.",
      "",
      "Mit freundlichen Grüßen",
      "Waldwirtschaft Heidekönig",
    ].join("\n"),
    subject: "Rückfrage zu Ihrer Reservierungsanfrage",
  };
}

export async function sendReservationDecision(
  input: ReservationDecisionInput,
  session: AuthenticatedSession,
) {
  const [reservation] = await db
    .select({
      guestCount: reservationRequests.guestCount,
      guestEmail: reservationRequests.guestEmail,
      guestName: reservationRequests.guestName,
      guestPhone: reservationRequests.guestPhone,
      id: reservationRequests.id,
      message: reservationRequests.message,
      requestedDate: reservationRequests.requestedDate,
      requestedTime: reservationRequests.requestedTime,
      status: reservationRequests.status,
    })
    .from(reservationRequests)
    .where(eq(reservationRequests.id, input.id))
    .limit(1);

  if (!reservation) {
    return {
      ok: false as const,
      message: "Reservierungsanfrage wurde nicht gefunden.",
    };
  }

  if (reservation.status !== input.expectedStatus) {
    return {
      ok: false as const,
      message:
        "Die Anfrage wurde zwischenzeitlich geändert. Bitte Seite neu laden und erneut prüfen.",
    };
  }

  const config = decisionConfig[input.decision];

  try {
    await sendGuestReservationDecisionEmail({
      body: input.body,
      guestEmail: reservation.guestEmail,
      guestName: reservation.guestName,
      replyTo: session.email,
      subject: input.subject,
    });
  } catch {
    await recordReservationOutgoingEmail({
      body: input.body,
      recipient: reservation.guestEmail,
      reservationRequestId: reservation.id,
      sentByUserId: session.userId,
      smtpError: sanitizeSmtpError(),
      smtpStatus: "failed",
      subject: input.subject,
      type: config.emailType,
    });

    return {
      ok: false as const,
      message: "E-Mail konnte nicht gesendet werden. Der Status wurde nicht geändert.",
    };
  }

  const result = await db.transaction(async (tx) => {
    if (config.targetStatus) {
      const [updatedReservation] = await tx
        .update(reservationRequests)
        .set({
          status: config.targetStatus,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(reservationRequests.id, input.id),
            eq(reservationRequests.status, input.expectedStatus),
          ),
        )
        .returning({ id: reservationRequests.id });

      if (!updatedReservation) {
        return {
          ok: false as const,
          message:
            "E-Mail wurde gesendet, aber der Status wurde zwischenzeitlich geändert. Bitte prüfen.",
        };
      }
    }

    await tx.insert(auditLog).values({
      action: config.auditAction,
      entityId: input.id,
      entityType: "reservation_request",
      metadata: {
        decision: input.decision,
        from: reservation.status,
        to: config.targetStatus ?? reservation.status,
      },
      userId: session.userId,
    });

    return {
      ok: true as const,
      message: config.successMessage,
    };
  });

  await recordReservationOutgoingEmail({
    body: input.body,
    recipient: reservation.guestEmail,
    reservationRequestId: reservation.id,
    sentAt: new Date(),
    sentByUserId: session.userId,
    smtpStatus: "sent",
    subject: input.subject,
    type: config.emailType,
  });

  if (result.ok && input.decision === "accept") {
    const internalNotificationSent = await sendInternalAcceptanceNotification(reservation, session);

    if (!internalNotificationSent) {
      return {
        ok: true as const,
        message:
          "Zusage wurde gesendet und der Status wurde auf angenommen gesetzt. Die interne Bestätigungs-E-Mail konnte nicht gesendet werden.",
      };
    }
  }

  return result;
}
