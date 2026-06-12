"use server";

import { reservationRequestSchema } from "@/src/lib/reservation-validation";
import {
  EmailConfigurationError,
  sendGuestReservationReceiptEmail,
  sendInternalReservationEmail,
} from "@/src/server/email";
import { assertPublicHostAction } from "@/src/server/guards";
import { checkRateLimit } from "@/src/server/rate-limit";
import { getClientRateLimitKey } from "@/src/server/request-security";
import { createReservationRequest } from "@/src/server/reservations";
import { getSetupStatus } from "@/src/server/setup";

export type ReservationFormState = {
  message?: string;
  fieldErrors?: Record<string, string[]>;
  success?: boolean;
};

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

  try {
    await sendInternalReservationEmail(result.emailData, result.availability);
  } catch (error) {
    if (!(error instanceof EmailConfigurationError)) {
      console.error("Internal reservation email failed.");
    }
  }

  try {
    await sendGuestReservationReceiptEmail(result.emailData);
  } catch (error) {
    if (!(error instanceof EmailConfigurationError)) {
      console.error("Guest reservation receipt email failed.");
    }
  }

  return {
    success: true,
    message:
      "Vielen Dank für Ihre Anfrage. Die Reservierung ist erst nach unserer persönlichen Bestätigung gültig.",
  };
}
