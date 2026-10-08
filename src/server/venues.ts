import { and, eq } from "drizzle-orm";
import { reservationRequests, venueHosts, venues } from "@/db/schema";
import { allowedHostSet, normalizeHost, originHost } from "@/src/lib/hostnames.mjs";
import { db } from "@/src/server/db";
import type { UserRole } from "@/src/lib/permissions";
import { canSelectAdminVenue } from "@/src/lib/venue-capabilities";

export type VenueContext = Readonly<typeof venues.$inferSelect>;

export class UnsupportedAvailabilityStrategyError extends Error {
  constructor() {
    super("Availability strategy is not implemented.");
  }
}

export function assertCapacityStrategy(venue: VenueContext) {
  if (!venue.isActive || venue.availabilityStrategy !== "CAPACITY") {
    throw new UnsupportedAvailabilityStrategyError();
  }
}

export async function getVenueById(id: string): Promise<VenueContext | null> {
  return (await db.query.venues.findFirst({ where: eq(venues.id, id) })) ?? null;
}

export async function getOperationalVenues(): Promise<VenueContext[]> {
  return db.query.venues.findMany({
    where: and(eq(venues.isActive, true), eq(venues.availabilityStrategy, "CAPACITY")),
    orderBy: venues.name,
  });
}

export async function getAdminSelectableVenues(role: UserRole): Promise<VenueContext[]> {
  const list = await db.query.venues.findMany({
    where: eq(venues.isActive, true),
    orderBy: venues.name,
  });
  return list.filter((venue) => canSelectAdminVenue(role, venue));
}

async function getVenueForHost(host: string) {
  const [venue] = await db
    .select({ venue: venues })
    .from(venueHosts)
    .innerJoin(venues, eq(venues.id, venueHosts.venueId))
    .where(and(eq(venueHosts.host, host), eq(venues.isActive, true)))
    .limit(1);
  return venue?.venue ?? null;
}

export async function resolvePublicVenue({
  host,
  origin = null,
  publicHosts,
  adminHosts,
}: {
  host: string;
  origin?: string | null;
  publicHosts: string[];
  adminHosts: string[];
}): Promise<VenueContext | null> {
  const normalized = normalizeHost(host).ascii;
  const allowed = allowedHostSet(publicHosts);
  const admin = allowedHostSet(adminHosts);
  if (!normalized || !allowed.has(normalized) || admin.has(normalized)) return null;
  const venue = await getVenueForHost(normalized);
  if (!venue) return null;
  const originHostname = originHost(origin);
  if (originHostname !== null) {
    if (!allowed.has(originHostname) || admin.has(originHostname)) return null;
    const originVenue = await getVenueForHost(originHostname);
    if (originVenue?.id !== venue.id) return null;
  }
  return venue;
}

export async function assertReservationVenue(venue: VenueContext, id: string) {
  const reservation = await db.query.reservationRequests.findFirst({
    columns: { id: true },
    where: and(eq(reservationRequests.id, id), eq(reservationRequests.venueId, venue.id)),
  });
  if (!reservation) throw new Error("Reservation is not available in this venue.");
}
