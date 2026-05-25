import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.log("Startup status: DATABASE_URL is not set.");
  process.exit(0);
}

const pool = new Pool({
  connectionString: databaseUrl,
  max: 1,
});

try {
  const setup = await pool.query(
    "select value from app_settings where key = 'setup_completed' limit 1",
  );
  const admins = await pool.query(
    "select count(*)::int as count from users where role = 'admin' and is_active = true",
  );

  const setupCompleted = setup.rows[0]?.value === "true";
  const activeAdmins = admins.rows[0]?.count ?? 0;

  if (setupCompleted && activeAdmins > 0) {
    console.log("Startup status: setup completed, app is ready.");
  } else {
    console.log("Startup status: setup wizard required at /setup on the admin host.");
  }
} catch (error) {
  console.log(
    `Startup status: unavailable (${error instanceof Error ? error.message : "unknown error"}).`,
  );
} finally {
  await pool.end();
}
