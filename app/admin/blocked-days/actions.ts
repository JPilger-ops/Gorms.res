"use server";

import { revalidatePath } from "next/cache";
import { createBlockedDaySchema, deleteBlockedDaySchema } from "@/src/lib/blocked-days-validation";
import {
  createReservationEventSchema,
  deleteReservationEventSchema,
} from "@/src/lib/reservation-events-validation";
import { createBlockedDay, deleteBlockedDay } from "@/src/server/blocked-days";
import { requireVenuePermission } from "@/src/server/guards";
import { createReservationEvent, deleteReservationEvent } from "@/src/server/reservation-events";

export type BlockedDayActionState = {
  message?: string;
  fieldErrors?: Record<string, string[]>;
  success?: boolean;
};

export async function createBlockedDayAction(
  _previousState: BlockedDayActionState,
  formData: FormData,
): Promise<BlockedDayActionState> {
  const { session, venue } = await requireVenuePermission(
    "blocked-days:manage",
    String(formData.get("venueId") ?? ""),
  );
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

  await createBlockedDay(venue, parsed.data, session);
  revalidatePath("/admin/blocked-days");
  revalidatePath("/admin");

  return {
    success: true,
    message: "Sperrtag wurde gespeichert.",
  };
}

export async function deleteBlockedDayAction(formData: FormData) {
  const { session, venue } = await requireVenuePermission(
    "blocked-days:manage",
    String(formData.get("venueId") ?? ""),
  );
  const parsed = deleteBlockedDaySchema.safeParse({
    id: formData.get("id"),
  });

  if (!parsed.success) {
    return;
  }

  await deleteBlockedDay(venue, parsed.data.id, session);
  revalidatePath("/admin/blocked-days");
  revalidatePath("/admin");
}

export async function createReservationEventAction(
  _previousState: BlockedDayActionState,
  formData: FormData,
): Promise<BlockedDayActionState> {
  const { session, venue } = await requireVenuePermission(
    "blocked-days:manage",
    String(formData.get("venueId") ?? ""),
  );
  const parsed = createReservationEventSchema.safeParse({
    date: formData.get("date"),
    publicNote: formData.get("publicNote"),
    reservationsAllowed: formData.get("reservationsAllowed") === "on",
    title: formData.get("title"),
  });

  if (!parsed.success) {
    return {
      message: "Bitte Eingaben prüfen.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  await createReservationEvent(venue, parsed.data, session);
  revalidatePath("/admin/blocked-days");
  revalidatePath("/admin");

  return {
    success: true,
    message: "Eventtag wurde gespeichert.",
  };
}

export async function deleteReservationEventAction(formData: FormData) {
  const { session, venue } = await requireVenuePermission(
    "blocked-days:manage",
    String(formData.get("venueId") ?? ""),
  );
  const parsed = deleteReservationEventSchema.safeParse({
    id: formData.get("id"),
  });

  if (!parsed.success) {
    return;
  }

  await deleteReservationEvent(venue, parsed.data.id, session);
  revalidatePath("/admin/blocked-days");
  revalidatePath("/admin");
}
