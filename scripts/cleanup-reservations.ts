import "dotenv/config";
import { closeDb } from "@/src/server/db";
import { runRetentionCleanup } from "@/src/server/retention";

async function main() {
  const result = await runRetentionCleanup();

  console.log(
    [
      "Retention cleanup completed.",
      `Reservations deleted: ${result.reservationsDeleted}`,
      `Audit logs deleted: ${result.auditLogsDeleted}`,
      `Reservation cutoff: ${result.reservationCutoff.toISOString()}`,
      `Audit log cutoff: ${result.auditLogCutoff.toISOString()}`,
    ].join("\n"),
  );
}

main()
  .finally(async () => {
    await closeDb();
  })
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Retention cleanup failed.");
    process.exit(1);
  });
