"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { ADMIN_VENUE_COOKIE, requireAdminHost, requireAdminSession } from "@/src/server/guards";
import { getAdminSelectableVenues } from "@/src/server/venues";
import { adminHome } from "@/src/lib/admin-urls";
import { clearSessionCookie, deleteCurrentSession } from "@/src/server/sessions";

export async function logoutAction() {
  await requireAdminHost();
  await deleteCurrentSession();
  await clearSessionCookie();
  (await cookies()).delete(ADMIN_VENUE_COOKIE);

  redirect("/login");
}

export async function selectVenueAction(formData: FormData) {
  const session = await requireAdminSession();
  const id = String(formData.get("venueId") ?? "");
  const venues = await getAdminSelectableVenues(session.role);
  const venue = venues.find((venue) => venue.id === id);
  if (!venue) throw new Error("Venue is not available.");
  (await cookies()).set(ADMIN_VENUE_COOKIE, id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 8 * 60 * 60,
  });
  redirect(adminHome(venue));
}
