import { count, desc, eq, gt, sql } from "drizzle-orm";
import { appSettings, auditLog, reservationRequests, sessions, users } from "@/db/schema";
import { env, requiredSecretStatus } from "@/src/lib/env";
import { checkDatabaseConnection } from "@/src/server/db";
import { getEncryptionKeyStatus } from "@/src/server/encryption";
import { getAdminAllowedHosts, getPublicAllowedHosts } from "@/src/server/host-guard";
import { runSetupSystemCheck } from "@/src/server/system-check";
import { db } from "@/src/server/db";

export async function getSystemSecurityOverview() {
  const now = new Date();

  const [
    databaseOk,
    systemChecks,
    totalUsers,
    activeUsers,
    activeAdmins,
    activeSessions,
    totalReservations,
    pendingReservations,
    secretSettings,
    recentAuditEvents,
  ] = await Promise.all([
    checkDatabaseConnection(),
    runSetupSystemCheck(),
    db.select({ count: count() }).from(users),
    db.select({ count: count() }).from(users).where(eq(users.isActive, true)),
    db
      .select({ count: count() })
      .from(users)
      .where(sql`${users.isActive} = true and ${users.role} = 'admin'`),
    db.select({ count: count() }).from(sessions).where(gt(sessions.expiresAt, now)),
    db.select({ count: count() }).from(reservationRequests),
    db
      .select({ count: count() })
      .from(reservationRequests)
      .where(eq(reservationRequests.status, "pending")),
    db.select({ count: count() }).from(appSettings).where(eq(appSettings.isSecret, true)),
    db
      .select({
        action: auditLog.action,
        createdAt: auditLog.createdAt,
        entityType: auditLog.entityType,
        userName: users.name,
      })
      .from(auditLog)
      .leftJoin(users, eq(auditLog.userId, users.id))
      .orderBy(desc(auditLog.createdAt))
      .limit(10),
  ]);

  const appEncryptionKey = getEncryptionKeyStatus();
  const sessionSecret = requiredSecretStatus("SESSION_SECRET");
  const setupToken = requiredSecretStatus("SETUP_TOKEN");

  return {
    auditRetentionDays: env.AUDIT_LOG_RETENTION_DAYS,
    backupPath: env.BACKUP_CONTAINER_PATH,
    databaseOk,
    environment: process.env.NODE_ENV ?? "development",
    hostSecurity: {
      adminAllowedHosts: getAdminAllowedHosts(),
      adminCookieName: env.ADMIN_SESSION_COOKIE_NAME,
      publicAllowedHosts: getPublicAllowedHosts(),
    },
    recentAuditEvents,
    reservationRetentionDays: env.RESERVATION_RETENTION_DAYS,
    secrets: {
      appEncryptionKeySource: appEncryptionKey.isSet ? appEncryptionKey.source : "missing",
      sessionSecretSet: sessionSecret.isSet,
      setupTokenSet: setupToken.isSet,
    },
    stats: {
      activeAdmins: activeAdmins[0]?.count ?? 0,
      activeSessions: activeSessions[0]?.count ?? 0,
      activeUsers: activeUsers[0]?.count ?? 0,
      pendingReservations: pendingReservations[0]?.count ?? 0,
      secretSettings: secretSettings[0]?.count ?? 0,
      totalReservations: totalReservations[0]?.count ?? 0,
      totalUsers: totalUsers[0]?.count ?? 0,
    },
    systemChecks,
    uploadsPath: env.UPLOAD_DIR,
  };
}
