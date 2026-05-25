"use server";

import { revalidatePath } from "next/cache";
import { createBlockedDaySchema, deleteBlockedDaySchema } from "@/src/lib/blocked-days-validation";
import { createBlockedDay, deleteBlockedDay } from "@/src/server/blocked-days";
import { requirePermission } from "@/src/server/guards";

export type BlockedDayActionState = {
  message?: string;
  fieldErrors?: Record<string, string[]>;
  success?: boolean;
};

export async function createBlockedDayAction(
  _previousState: BlockedDayActionState,
  formData: FormData,
): Promise<BlockedDayActionState> {
  const session = await requirePermission("blocked-days:manage");
  const parsed = createBlockedDaySchema.safeParse({
    date: formData.get("date"),
    reason: formData.get("reason"),
  });

  if (!parsed.success) {
    return {
      message: "Bitte Eingaben prüfen.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  await createBlockedDay(parsed.data, session);
  revalidatePath("/admin/blocked-days");
  revalidatePath("/admin");

  return {
    success: true,
    message: "Sperrtag wurde gespeichert.",
  };
}

export async function deleteBlockedDayAction(formData: FormData) {
  const session = await requirePermission("blocked-days:manage");
  const parsed = deleteBlockedDaySchema.safeParse({
    id: formData.get("id"),
  });

  if (!parsed.success) {
    return;
  }

  await deleteBlockedDay(parsed.data.id, session);
  revalidatePath("/admin/blocked-days");
  revalidatePath("/admin");
}
