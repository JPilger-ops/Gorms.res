export const roles = ["admin", "mitarbeiter"] as const;

export type UserRole = (typeof roles)[number];

export const allPermissions = [
  "reservations:read",
  "reservations:manage",
  "blocked-days:manage",
  "opening-hours:manage",
  "settings:manage",
  "smtp:manage",
  "branding:manage",
  "users:manage",
  "system:read",
] as const;

export type Permission = (typeof allPermissions)[number];

const permissions: Record<UserRole, readonly Permission[]> = {
  admin: [
    "reservations:read",
    "reservations:manage",
    "blocked-days:manage",
    "opening-hours:manage",
    "settings:manage",
    "smtp:manage",
    "branding:manage",
    "users:manage",
    "system:read",
  ],
  mitarbeiter: ["reservations:read", "blocked-days:manage", "opening-hours:manage"],
};

export function hasPermission(role: UserRole, permission: Permission) {
  return permissions[role].includes(permission);
}

export function assertRole(value: string): UserRole {
  if (value === "admin" || value === "mitarbeiter") {
    return value;
  }

  throw new Error("Invalid user role.");
}
