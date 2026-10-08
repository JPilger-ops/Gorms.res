import { notFound, redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import type { Permission, UserRole } from "@/src/lib/permissions";
import { hasPermission } from "@/src/lib/permissions";
import {
  getPublicRequestVenue,
  isAdminHostRequest,
  isPublicHostRequest,
} from "@/src/server/host-guard";
import { getCurrentSession } from "@/src/server/sessions";
import { getAdminSelectableVenues, type VenueContext } from "@/src/server/venues";
import { supportsVenuePermission } from "@/src/lib/venue-capabilities";
import { HEIDEKOENIG_VENUE_ID } from "@/src/lib/venue-defaults.mjs";

export const ADMIN_VENUE_COOKIE = "gorms_admin_venue";

export type AuthenticatedSession = NonNullable<Awaited<ReturnType<typeof getCurrentSession>>>;

export async function requireAdminHost() {
  if (!(await isAdminHostRequest())) {
    notFound();
  }
}

export async function assertAdminHostAction() {
  return isAdminHostRequest();
}

export async function requirePublicHost() {
  const venue = await getPublicRequestVenue();
  if (!venue) notFound();
  if (venue.availabilityStrategy !== "CAPACITY") notFound();
  return venue;
}

export async function assertPublicHostAction() {
  return isPublicHostRequest();
}

export async function requireAdminSession() {
  await requireAdminHost();

  const session = await getCurrentSession();

  if (!session) {
    redirect("/login");
  }

  return session;
}

export async function requireRole(allowedRoles: UserRole[]) {
  const session = await requireAdminSession();

  if (!allowedRoles.includes(session.role)) {
    notFound();
  }

  return session;
}

export async function requirePermission(permission: Permission) {
  const session = await requireAdminSession();

  if (!hasPermission(session.role, permission)) {
    notFound();
  }

  return session;
}

export async function getAdminVenue(): Promise<VenueContext> {
  const session = await requireAdminSession();
  const venue = await getAdminVenueForSession(session);
  if (!venue) notFound();
  return venue;
}

export async function getAdminVenueForSession(
  session: AuthenticatedSession,
): Promise<VenueContext | null> {
  const path = (await headers()).get("x-gorms-request-path");
  const values = new URL(path ?? "/admin", "http://admin.invalid").searchParams.getAll("venue");
  if (values.length > 1) return null;
  const selectedId = values.length
    ? values[0]
    : ((await cookies()).get(ADMIN_VENUE_COOKIE)?.value ?? HEIDEKOENIG_VENUE_ID);
  const operational = await getAdminSelectableVenues(session.role);
  const venue = operational.find((entry) => entry.id === selectedId);
  return venue ?? null;
}

export async function requireVenuePermission(
  permission: Permission,
  expectedVenueId?: string | null,
) {
  const session = await requirePermission(permission);
  const venue = await getAdminVenue();
  if (!supportsVenuePermission(venue, permission)) notFound();
  if (expectedVenueId !== undefined && expectedVenueId !== venue.id) notFound();
  return { session, venue };
}
