import { auditLog } from "@/db/schema";
import { db } from "@/src/server/db";

export async function recordSecurityEvent({
  action,
  entityId,
  metadata = {},
  userId,
}: {
  action: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  userId?: string;
}) {
  await db.insert(auditLog).values({
    action,
    entityId,
    entityType: "security",
    metadata,
    userId,
  });
}
