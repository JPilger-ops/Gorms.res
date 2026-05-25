"use server";

import { revalidatePath } from "next/cache";
import { openingHoursSchema } from "@/src/lib/opening-hours-validation";
import { requirePermission } from "@/src/server/guards";
import { updateOpeningHours } from "@/src/server/settings";

export type OpeningHoursActionState = {
  message?: string;
  fieldErrors?: Record<string, string[]>;
  success?: boolean;
};

export async function updateOpeningHoursAction(
  _previousState: OpeningHoursActionState,
  formData: FormData,
): Promise<OpeningHoursActionState> {
  const session = await requirePermission("opening-hours:manage");
  const parsed = openingHoursSchema.safeParse({
    earliestReservationTime: formData.get("earliestReservationTime"),
    latestReservationTime: formData.get("latestReservationTime"),
  });

  if (!parsed.success) {
    return {
      message: "Bitte Eingaben prüfen.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  await updateOpeningHours(parsed.data, session);
  revalidatePath("/admin/opening-hours");
  revalidatePath("/admin");

  return {
    success: true,
    message: "Öffnungszeiten wurden gespeichert.",
  };
}
