import { notFound, redirect } from "next/navigation";
import type { Permission, UserRole } from "@/src/lib/permissions";
import { hasPermission } from "@/src/lib/permissions";
import { isAdminHostRequest, isPublicHostRequest } from "@/src/server/host-guard";
import { getCurrentSession } from "@/src/server/sessions";

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
  if (!(await isPublicHostRequest())) {
    notFound();
  }
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
