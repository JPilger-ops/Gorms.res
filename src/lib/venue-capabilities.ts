import type { Permission, UserRole } from "./permissions";

type VenueStrategy = { isActive: boolean; availabilityStrategy: "CAPACITY" | "TABLES" };
export function canSelectAdminVenue(role: UserRole, venue: VenueStrategy) {
  return venue.isActive && (venue.availabilityStrategy === "CAPACITY" || role === "admin");
}
export function supportsVenuePermission(venue: VenueStrategy, permission: Permission) {
  if (!venue.isActive) return false;
  if (permission === "table-plan:manage") return venue.availabilityStrategy === "TABLES";
  if (permission === "system:read" || permission === "users:manage") return true;
  return venue.availabilityStrategy === "CAPACITY";
}
