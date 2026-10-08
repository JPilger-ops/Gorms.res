import "dotenv/config";
import { Pool } from "pg";
import { cleanupFloorplans } from "./floorplan-cleanup-lib.mjs";

if (!process.env.DATABASE_URL || !process.env.UPLOAD_DIR)
  throw new Error("DATABASE_URL and UPLOAD_DIR are required.");
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
try {
  const result = await cleanupFloorplans(pool, { uploadDir: process.env.UPLOAD_DIR });
  console.log("Floorplan cleanup completed:", result);
} catch {
  console.error(
    "Floorplan cleanup failed. No uncertain assets are removed; check database and storage access.",
  );
  process.exitCode = 1;
} finally {
  await pool.end();
}
