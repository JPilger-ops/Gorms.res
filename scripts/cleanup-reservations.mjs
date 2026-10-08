import "dotenv/config";
import { Pool } from "pg";
import { cleanupRetention } from "./retention-lib.mjs";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required for retention cleanup.");
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
try {
  const result = await cleanupRetention(pool);
  console.log("Retention cleanup completed.");
  console.log(`Reservations anonymized: ${result.reservationsAnonymized}`);
  console.log(`Outgoing emails anonymized: ${result.outgoingEmailsAnonymized}`);
  console.log(`Audit logs scrubbed: ${result.auditLogsScrubbed}`);
  console.log(`Audit logs deleted: ${result.auditLogsDeleted}`);
  for (const venue of result.venueResults) {
    console.log(
      `Venue ${venue.venueId}: ${venue.reservationRetentionDays} days; cutoff ${venue.reservationCutoff.toISOString()}`,
    );
  }
} finally {
  await pool.end();
}
