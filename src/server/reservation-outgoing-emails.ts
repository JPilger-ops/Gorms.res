import { desc, eq } from "drizzle-orm";
import { reservationOutgoingEmails } from "@/db/schema";
import { db } from "@/src/server/db";
import { assertReservationVenue, type VenueContext } from "@/src/server/venues";

export type ReservationOutgoingEmailType =
  | "guest_receipt"
  | "staff_notification"
  | "guest_acceptance"
  | "guest_decline"
  | "guest_question"
  | "staff_acceptance_notification";

export type ReservationOutgoingEmailInput = {
  body: string;
  recipient: string;
  reservationRequestId: string;
  sentAt?: Date;
  sentByUserId?: string;
  smtpError?: string;
  smtpStatus: "sent" | "failed";
  subject: string;
  type: ReservationOutgoingEmailType;
};

export async function recordReservationOutgoingEmail(
  venue: VenueContext,
  input: ReservationOutgoingEmailInput,
) {
  await assertReservationVenue(venue, input.reservationRequestId);
  const [email] = await db
    .insert(reservationOutgoingEmails)
    .values({
      body: input.body,
      recipient: input.recipient,
      reservationRequestId: input.reservationRequestId,
      sentAt: input.sentAt,
      sentByUserId: input.sentByUserId,
      smtpError: input.smtpError,
      smtpStatus: input.smtpStatus,
      subject: input.subject,
      type: input.type,
    })
    .returning();

  return email;
}

export async function listOutgoingEmailsForReservation(
  venue: VenueContext,
  reservationRequestId: string,
) {
  await assertReservationVenue(venue, reservationRequestId);
  return db.query.reservationOutgoingEmails.findMany({
    orderBy: [desc(reservationOutgoingEmails.createdAt)],
    where: eq(reservationOutgoingEmails.reservationRequestId, reservationRequestId),
  });
}
