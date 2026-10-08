import "dotenv/config";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { importLegacyPublicHosts } from "./venue-hosts-lib.mjs";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for migrations.");
}

const pool = new Pool({
  connectionString: databaseUrl,
  max: 1,
});

try {
  const db = drizzle(pool);
  await migrate(db, { migrationsFolder: "db/migrations" });
  await importLegacyPublicHosts(pool, {
    publicHosts: process.env.PUBLIC_ALLOWED_HOSTS,
    adminHosts: process.env.ADMIN_ALLOWED_HOSTS,
  });
  console.log("Database migrations completed.");
} catch {
  console.error(
    "Database migration or legacy host import failed. Resolve configuration and rerun the migration command.",
  );
  process.exitCode = 1;
} finally {
  await pool.end();
}
