import { and, eq } from "drizzle-orm";
import { auditLog, reservationRequests } from "@/db/schema";
import type {
  ReservationDecisionInput,
  ReservationDecisionType,
} from "@/src/lib/reservation-decision-validation";
import { db } from "@/src/server/db";
import { sendGuestReservationDecisionEmail } from "@/src/server/email";
import type { AuthenticatedSession } from "@/src/server/guards";
import { recordReservationOutgoingEmail } from "@/src/server/reservation-outgoing-emails";
import type { ReservationStatus } from "@/src/server/reservations";

type DecisionDraftReservation = {
  guestCount: number;
  guestEmail: string;
  guestName: string;
  requestedDate: string;
  requestedTime: string;
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

function sanitizeSmtpError(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message.slice(0, 240);
  }

  return "SMTP-Versand fehlgeschlagen.";
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
      guestEmail: reservationRequests.guestEmail,
      guestName: reservationRequests.guestName,
      id: reservationRequests.id,
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
  } catch (error) {
    await recordReservationOutgoingEmail({
      body: input.body,
      recipient: reservation.guestEmail,
      reservationRequestId: reservation.id,
      sentByUserId: session.userId,
      smtpError: sanitizeSmtpError(error),
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

  return result;
}
