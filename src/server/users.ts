import { and, asc, eq, ne, sql } from "drizzle-orm";
import { auditLog, sessions, users } from "@/db/schema";
import type {
  CreateUserInput,
  ResetUserPasswordInput,
  UpdateUserInput,
} from "@/src/lib/user-validation";
import { db } from "@/src/server/db";
import type { AuthenticatedSession } from "@/src/server/guards";
import { hashPassword } from "@/src/server/passwords";

export async function getAdminUsers() {
  return db
    .select({
      createdAt: users.createdAt,
      email: users.email,
      id: users.id,
      isActive: users.isActive,
      lastLoginAt: users.lastLoginAt,
      name: users.name,
      role: users.role,
      updatedAt: users.updatedAt,
    })
    .from(users)
    .orderBy(asc(users.name), asc(users.email));
}

async function activeAdminCount() {
  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(users)
    .where(and(eq(users.role, "admin"), eq(users.isActive, true)));

  return result?.count ?? 0;
}

async function emailBelongsToOtherUser(email: string, userId?: string) {
  const conditions = userId
    ? and(eq(users.email, email), ne(users.id, userId))
    : eq(users.email, email);

  const [existingUser] = await db.select({ id: users.id }).from(users).where(conditions).limit(1);

  return Boolean(existingUser);
}

export async function createUser(input: CreateUserInput, session: AuthenticatedSession) {
  if (await emailBelongsToOtherUser(input.email)) {
    return { ok: false as const, message: "Benutzer konnte nicht gespeichert werden." };
  }

  const passwordHash = await hashPassword(input.password);

  const [user] = await db
    .insert(users)
    .values({
      email: input.email,
      isActive: true,
      name: input.name,
      passwordHash,
      role: input.role,
    })
    .returning({ id: users.id });

  await db.insert(auditLog).values({
    action: "user.create",
    entityId: user.id,
    entityType: "user",
    metadata: { role: input.role },
    userId: session.userId,
  });

  return { ok: true as const };
}

export async function updateUser(input: UpdateUserInput, session: AuthenticatedSession) {
  const [targetUser] = await db
    .select({
      id: users.id,
      isActive: users.isActive,
      role: users.role,
    })
    .from(users)
    .where(eq(users.id, input.id))
    .limit(1);

  if (!targetUser) {
    return { ok: false as const, message: "Benutzer konnte nicht gespeichert werden." };
  }

  if (input.id === session.userId && (input.role !== session.role || !input.isActive)) {
    return {
      ok: false as const,
      message: "Die eigene Rolle oder Aktivierung kann hier nicht geändert werden.",
    };
  }

  const removesActiveAdmin =
    targetUser.role === "admin" &&
    targetUser.isActive &&
    (input.role !== "admin" || !input.isActive);

  if (removesActiveAdmin && (await activeAdminCount()) <= 1) {
    return {
      ok: false as const,
      message: "Der letzte aktive Admin darf nicht deaktiviert werden.",
    };
  }

  if (await emailBelongsToOtherUser(input.email, input.id)) {
    return { ok: false as const, message: "Benutzer konnte nicht gespeichert werden." };
  }

  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({
        email: input.email,
        isActive: input.isActive,
        name: input.name,
        role: input.role,
        updatedAt: new Date(),
      })
      .where(eq(users.id, input.id));

    if (!input.isActive) {
      await tx.delete(sessions).where(eq(sessions.userId, input.id));
    }

    await tx.insert(auditLog).values({
      action: "user.update",
      entityId: input.id,
      entityType: "user",
      metadata: { isActive: input.isActive, role: input.role },
      userId: session.userId,
    });
  });

  return { ok: true as const };
}

export async function resetUserPassword(
  input: ResetUserPasswordInput,
  session: AuthenticatedSession,
) {
  const [targetUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, input.id))
    .limit(1);

  if (!targetUser) {
    return { ok: false as const, message: "Passwort konnte nicht gesetzt werden." };
  }

  const passwordHash = await hashPassword(input.password);

  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({
        passwordHash,
        updatedAt: new Date(),
      })
      .where(eq(users.id, input.id));

    await tx.delete(sessions).where(eq(sessions.userId, input.id));

    await tx.insert(auditLog).values({
      action: "user.password_reset",
      entityId: input.id,
      entityType: "user",
      metadata: {},
      userId: session.userId,
    });
  });

  return { ok: true as const };
}
