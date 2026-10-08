"use server";

import { revalidatePath } from "next/cache";
import { requireVenuePermission } from "@/src/server/guards";
import { saveTablePlanArea } from "@/src/server/table-plan";
import { checkRateLimit } from "@/src/server/rate-limit";
import { TablePlanError } from "@/src/lib/table-plan-types";

export type AreaActionState = { success?: boolean; message?: string };
export async function saveAreaAction(
  _state: AreaActionState,
  form: FormData,
): Promise<AreaActionState> {
  const { venue, session } = await requireVenuePermission(
    "table-plan:manage",
    String(form.get("venueId") ?? ""),
  );
  if (!checkRateLimit(`table-plan-area:${session.userId}`, 30, 60_000))
    return { message: "Bitte kurz warten und erneut versuchen." };
  try {
    await saveTablePlanArea(
      venue,
      {
        ...(form.get("id")
          ? { id: String(form.get("id")), baseRevision: Number(form.get("baseRevision")) }
          : {}),
        name: String(form.get("name") ?? ""),
        sortOrder: Number(form.get("sortOrder") ?? 0),
        isActive: form.get("isActive") === "on",
        isOnlineBookable: form.get("isOnlineBookable") === "on",
        archived: form.get("archived") === "on",
      },
      session,
    );
    revalidatePath("/admin/table-plan");
    return { success: true, message: "Bereich gespeichert." };
  } catch (error) {
    return {
      message:
        error instanceof TablePlanError
          ? error.message
          : "Der Bereich konnte nicht gespeichert werden.",
    };
  }
}
