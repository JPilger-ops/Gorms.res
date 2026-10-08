import "dotenv/config";
import { Pool } from "pg";
import { configureVenueHosts } from "./venue-hosts-lib.mjs";

const [slug, hosts] = process.argv.slice(2);
if (!process.env.DATABASE_URL || !slug || !hosts) {
  throw new Error("Usage: npm run venue:hosts -- <venue-slug> <comma-separated-hosts>");
}
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
try {
  await configureVenueHosts(pool, {
    slug,
    hosts,
    publicHosts: process.env.PUBLIC_ALLOWED_HOSTS,
    adminHosts: process.env.ADMIN_ALLOWED_HOSTS,
  });
  console.log("Venue hosts configured. Existing assignments were preserved.");
} catch {
  console.error("Host configuration failed. Check the venue, allowlist and existing assignments.");
  process.exitCode = 1;
} finally {
  await pool.end();
}
