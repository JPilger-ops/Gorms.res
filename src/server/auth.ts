import { eq } from "drizzle-orm";
import { auditLog, users } from "@/db/schema";
import type { LoginInput } from "@/src/lib/auth-validation";
import { db } from "@/src/server/db";
import { verifyPassword } from "@/src/server/passwords";
import { createSession, setSessionCookie } from "@/src/server/sessions";

export async function login(input: LoginInput) {
  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      passwordHash: users.passwordHash,
      isActive: users.isActive,
    })
    .from(users)
    .where(eq(users.email, input.email))
    .limit(1);

  if (!user?.isActive) {
    return false;
  }

  const passwordValid = await verifyPassword(user.passwordHash, input.password);

  if (!passwordValid) {
    return false;
  }

  const session = await createSession(user.id);
  await setSessionCookie(session.token, session.expiresAt);

  await db
    .update(users)
    .set({ lastLoginAt: new Date(), updatedAt: new Date() })
    .where(eq(users.id, user.id));

  await db.insert(auditLog).values({
    userId: user.id,
    action: "auth.login",
    entityType: "user",
    entityId: user.id,
    metadata: {},
  });

  return true;
}
