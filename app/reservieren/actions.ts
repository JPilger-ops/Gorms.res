"use server";

import { reservationRequestSchema } from "@/src/lib/reservation-validation";
import {
  buildGuestReservationReceiptEmailContent,
  buildInternalReservationEmailContent,
  EmailConfigurationError,
  sendGuestReservationReceiptEmail,
  sendInternalReservationEmail,
  type ReservationOutgoingEmailContent,
} from "@/src/server/email";
import { assertPublicHostAction } from "@/src/server/guards";
import { checkRateLimit } from "@/src/server/rate-limit";
import { recordReservationOutgoingEmail } from "@/src/server/reservation-outgoing-emails";
import type { ReservationOutgoingEmailType } from "@/src/server/reservation-outgoing-emails";
import { getClientRateLimitKey } from "@/src/server/request-security";
import { createReservationRequest } from "@/src/server/reservations";
import { getSetupStatus } from "@/src/server/setup";

export type ReservationFormState = {
  message?: string;
  fieldErrors?: Record<string, string[]>;
  success?: boolean;
};

function sanitizeSmtpError(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message.slice(0, 240);
  }

  return "SMTP-Versand fehlgeschlagen.";
}

async function recordInitialOutgoingEmail({
  content,
  error,
  reservationRequestId,
  type,
}: {
  content: ReservationOutgoingEmailContent;
  error?: unknown;
  reservationRequestId: string;
  type: Extract<ReservationOutgoingEmailType, "guest_receipt" | "staff_notification">;
}) {
  try {
    await recordReservationOutgoingEmail({
      body: content.text,
      recipient: content.recipient,
      reservationRequestId,
      sentAt: error ? undefined : new Date(),
      smtpError: error ? sanitizeSmtpError(error) : undefined,
      smtpStatus: error ? "failed" : "sent",
      subject: content.subject,
      type,
    });
  } catch {
    console.error("Outgoing email history write failed.");
  }
}

export async function createReservationRequestAction(
  _previousState: ReservationFormState,
  formData: FormData,
): Promise<ReservationFormState> {
  if (!(await assertPublicHostAction())) {
    return { message: "Reservierungsanfragen sind unter dieser Adresse nicht verfügbar." };
  }

  const status = await getSetupStatus();

  if (!status.setupCompleted) {
    return { message: "Reservierungsanfragen sind erst nach Abschluss der Einrichtung möglich." };
  }

  const rateLimitKey = await getClientRateLimitKey("reservation");

  if (!checkRateLimit(rateLimitKey, 5, 15 * 60 * 1000)) {
    return { message: "Bitte später erneut versuchen." };
  }

  const parsed = reservationRequestSchema.safeParse({
    date: formData.get("date"),
    email: formData.get("email"),
    guestCount: formData.get("guestCount"),
    guestName: formData.get("guestName"),
    message: formData.get("message"),
    phone: formData.get("phone"),
    privacyAccepted: formData.get("privacyAccepted"),
    time: formData.get("time"),
    website: formData.get("website"),
  });

  if (!parsed.success) {
    return {
      message: "Bitte Eingaben prüfen.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const result = await createReservationRequest(parsed.data);

  if (!result.ok) {
    return {
      message: result.reasons[0] ?? "Die Anfrage kann für diesen Termin nicht gesendet werden.",
    };
  }

  let internalEmailContent: ReservationOutgoingEmailContent | null = null;

  try {
    internalEmailContent = await buildInternalReservationEmailContent(
      result.emailData,
      result.availability,
    );
    await sendInternalReservationEmail(result.emailData, result.availability, internalEmailContent);
    await recordInitialOutgoingEmail({
      content: internalEmailContent,
      reservationRequestId: result.id,
      type: "staff_notification",
    });
  } catch (error) {
    if (internalEmailContent) {
      await recordInitialOutgoingEmail({
        content: internalEmailContent,
        error,
        reservationRequestId: result.id,
        type: "staff_notification",
      });
    }

    if (!(error instanceof EmailConfigurationError)) {
      console.error("Internal reservation email failed.");
    }
  }

  let guestEmailContent: ReservationOutgoingEmailContent | null = null;

  try {
    guestEmailContent = await buildGuestReservationReceiptEmailContent(result.emailData);
    await sendGuestReservationReceiptEmail(result.emailData, guestEmailContent);
    await recordInitialOutgoingEmail({
      content: guestEmailContent,
      reservationRequestId: result.id,
      type: "guest_receipt",
    });
  } catch (error) {
    if (guestEmailContent) {
      await recordInitialOutgoingEmail({
        content: guestEmailContent,
        error,
        reservationRequestId: result.id,
        type: "guest_receipt",
      });
    }

    if (!(error instanceof EmailConfigurationError)) {
      console.error("Guest reservation receipt email failed.");
    }
  }

  return {
    success: true,
    message:
      "Ihre Anfrage ist eingegangen. Die Reservierung ist erst nach unserer persönlichen Bestätigung gültig.",
  };
}
