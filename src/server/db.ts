import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@/db/schema";

const databaseUrl = process.env.DATABASE_URL;

const globalForDb = globalThis as typeof globalThis & {
  heidekoenigPool?: Pool;
};

const pool =
  globalForDb.heidekoenigPool ??
  new Pool({
    connectionString: databaseUrl,
    max: 10,
    idleTimeoutMillis: 30_000,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.heidekoenigPool = pool;
}

export const db = drizzle(pool, { schema });

export async function checkDatabaseConnection() {
  if (!databaseUrl) {
    return false;
  }

  try {
    await pool.query("select 1");
    return true;
  } catch {
    return false;
  }
}

export async function closeDb() {
  await pool.end();
}
