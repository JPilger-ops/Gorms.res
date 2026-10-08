import { cleanupRetention } from "@/scripts/retention-lib.mjs";
import { env } from "@/src/lib/env";
import { pool } from "@/src/server/db";
import type { AuthenticatedSession } from "@/src/server/guards";
import type { VenueContext } from "@/src/server/venues";

export type { RetentionCleanupResult } from "@/scripts/retention-lib.mjs";

export async function runRetentionCleanup({
  now = new Date(),
  session,
  venue,
}: {
  now?: Date;
  session?: AuthenticatedSession;
  venue?: VenueContext;
} = {}) {
  return cleanupRetention(pool, {
    now,
    userId: session?.userId,
    venueId: venue?.id,
    reservationFallback: env.RESERVATION_RETENTION_DAYS,
    auditFallback: env.AUDIT_LOG_RETENTION_DAYS,
  });
}
