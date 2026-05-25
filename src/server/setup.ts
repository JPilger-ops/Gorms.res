import { and, eq, sql } from "drizzle-orm";
import { createHash, timingSafeEqual } from "node:crypto";
import { appSettings, auditLog, users } from "@/db/schema";
import type { SetupAdminInput } from "@/src/lib/setup-validation";
import { db } from "@/src/server/db";
import { hashPassword } from "@/src/server/passwords";

export const SETUP_COMPLETED_KEY = "setup_completed";

function constantTimeEquals(a: string, b: string) {
  const left = createHash("sha256").update(a).digest();
  const right = createHash("sha256").update(b).digest();
  return timingSafeEqual(left, right);
}

export async function getSetupStatus() {
  const [adminCountResult, setupSetting] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(and(eq(users.role, "admin"), eq(users.isActive, true))),
    db.query.appSettings.findFirst({
      where: eq(appSettings.key, SETUP_COMPLETED_KEY),
      columns: { value: true },
    }),
  ]);

  const hasAdmin = (adminCountResult[0]?.count ?? 0) > 0;
  const setupCompleted = setupSetting?.value === "true";

  return {
    hasAdmin,
    setupCompleted,
    canRunSetup: !hasAdmin && !setupCompleted,
  };
}

export function verifySetupToken(candidate: string) {
  const setupToken = process.env.SETUP_TOKEN;

  if (!setupToken || setupToken.length < 16) {
    return false;
  }

  return constantTimeEquals(candidate, setupToken);
}

export async function createInitialAdmin(input: SetupAdminInput) {
  const status = await getSetupStatus();

  if (!status.canRunSetup) {
    return { ok: false as const, message: "Setup ist nicht verfügbar." };
  }

  if (!verifySetupToken(input.setupToken)) {
    return { ok: false as const, message: "Setup konnte nicht abgeschlossen werden." };
  }

  const passwordHash = await hashPassword(input.password);

  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('heidekoenig_setup'))`);

    const [adminCountResult, setupSetting] = await Promise.all([
      tx
        .select({ count: sql<number>`count(*)::int` })
        .from(users)
        .where(and(eq(users.role, "admin"), eq(users.isActive, true))),
      tx.query.appSettings.findFirst({
        where: eq(appSettings.key, SETUP_COMPLETED_KEY),
        columns: { value: true },
      }),
    ]);

    if ((adminCountResult[0]?.count ?? 0) > 0 || setupSetting?.value === "true") {
      return { ok: false as const, message: "Setup ist nicht verfügbar." };
    }

    const [admin] = await tx
      .insert(users)
      .values({
        email: input.email,
        name: input.name,
        passwordHash,
        role: "admin",
        isActive: true,
      })
      .returning({ id: users.id });

    await tx
      .insert(appSettings)
      .values({
        key: SETUP_COMPLETED_KEY,
        value: "true",
        isSecret: false,
        updatedByUserId: admin.id,
      })
      .onConflictDoUpdate({
        target: appSettings.key,
        set: {
          value: "true",
          isSecret: false,
          updatedByUserId: admin.id,
          updatedAt: new Date(),
        },
      });

    await tx.insert(auditLog).values({
      userId: admin.id,
      action: "setup.completed",
      entityType: "setup",
      entityId: SETUP_COMPLETED_KEY,
      metadata: {},
    });

    return { ok: true as const };
  });
}
