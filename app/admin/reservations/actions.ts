"use server";

import { revalidatePath } from "next/cache";
import { updateReservationStatusSchema } from "@/src/lib/reservation-status-validation";
import { requirePermission } from "@/src/server/guards";
import { updateReservationStatus } from "@/src/server/reservations";

export type ReservationStatusActionState = {
  fieldErrors?: Record<string, string[]>;
  message?: string;
  success?: boolean;
};

export async function updateReservationStatusAction(
  _previousState: ReservationStatusActionState,
  formData: FormData,
): Promise<ReservationStatusActionState> {
  const session = await requirePermission("reservations:status_override");
  const parsed = updateReservationStatusSchema.safeParse({
    id: formData.get("id"),
    reason: formData.get("reason"),
    status: formData.get("status"),
  });

  if (!parsed.success) {
    return {
      fieldErrors: parsed.error.flatten().fieldErrors,
      message: "Status konnte nicht gespeichert werden.",
    };
  }

  const result = await updateReservationStatus(parsed.data, session);

  if (!result.ok) {
    return { message: result.message };
  }

  revalidatePath("/admin/reservations");
  revalidatePath(`/admin/reservations/${parsed.data.id}`);
  revalidatePath("/admin");
  revalidatePath("/admin/system");

  return {
    message: result.changed
      ? "Sonderfall-Status wurde gespeichert. Es wurde keine E-Mail gesendet."
      : "Status war bereits gesetzt.",
    success: true,
  };
}
