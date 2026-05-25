import { migrate } from "drizzle-orm/node-postgres/migrator";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

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
  console.log("Database migrations completed.");
} finally {
  await pool.end();
}
