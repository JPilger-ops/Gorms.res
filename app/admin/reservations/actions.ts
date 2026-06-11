"use server";

import { revalidatePath } from "next/cache";
import { updateReservationStatusSchema } from "@/src/lib/reservation-status-validation";
import { requirePermission } from "@/src/server/guards";
import { updateReservationStatus } from "@/src/server/reservations";

export async function updateReservationStatusAction(formData: FormData) {
  const session = await requirePermission("reservations:manage");
  const parsed = updateReservationStatusSchema.safeParse({
    id: formData.get("id"),
    status: formData.get("status"),
  });

  if (!parsed.success) {
    return;
  }

  await updateReservationStatus(parsed.data, session);
  revalidatePath("/admin/reservations");
  revalidatePath("/admin");
  revalidatePath("/admin/system");
}
