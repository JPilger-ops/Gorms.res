"use server";

import { revalidatePath } from "next/cache";
import { updateReservationStatusSchema } from "@/src/lib/reservation-status-validation";
import { requirePermission } from "@/src/server/guards";
import { updateReservationStatus } from "@/src/server/reservations";

export type ReservationStatusActionState = {
  message?: string;
  success?: boolean;
};

export async function updateReservationStatusAction(
  _previousState: ReservationStatusActionState,
  formData: FormData,
): Promise<ReservationStatusActionState> {
  const session = await requirePermission("reservations:manage");
  const parsed = updateReservationStatusSchema.safeParse({
    id: formData.get("id"),
    status: formData.get("status"),
  });

  if (!parsed.success) {
    return { message: "Status konnte nicht gespeichert werden." };
  }

  const result = await updateReservationStatus(parsed.data, session);

  if (!result.ok) {
    return { message: result.message };
  }

  revalidatePath("/admin/reservations");
  revalidatePath("/admin");
  revalidatePath("/admin/system");

  return {
    message: result.changed ? "Status wurde gespeichert." : "Status war bereits gesetzt.",
    success: true,
  };
}
