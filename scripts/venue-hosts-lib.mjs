import { allowedHostSet, normalizeHost, splitHosts } from "../src/lib/hostnames.mjs";
import {
  DEFAULT_PUBLIC_HOSTS,
  HEIDEKOENIG_VENUE_ID,
  LEGACY_HOST_IMPORT_KEY,
} from "../src/lib/venue-defaults.mjs";

function checkedHosts(value, adminHosts) {
  const hosts = splitHosts(value).map((host) => normalizeHost(host).ascii);
  const admin = allowedHostSet(splitHosts(adminHosts ?? "login.gorms.de"));
  if (!hosts.length || hosts.some((host) => !host || host.length > 253 || admin.has(host))) {
    throw new Error("Invalid public host configuration.");
  }
  return [...new Set(hosts)];
}

async function insertHosts(client, venueId, hosts) {
  for (const host of hosts) {
    const existing = await client.query("select venue_id from venue_hosts where host = $1", [host]);
    if (existing.rows[0] && existing.rows[0].venue_id !== venueId) {
      throw new Error("Public host is already assigned to another venue.");
    }
    await client.query(
      "insert into venue_hosts (host, venue_id) values ($1, $2) on conflict (host) do nothing",
      [host, venueId],
    );
  }
}

export async function importLegacyPublicHosts(pool, { publicHosts, adminHosts } = {}) {
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("select pg_advisory_xact_lock(hashtext('gorms_venue_hosts'))");
    const marker = await client.query("select value from app_settings where key = $1", [
      LEGACY_HOST_IMPORT_KEY,
    ]);
    if (marker.rows[0]?.value === "true") {
      await client.query("commit");
      return false;
    }
    const hosts = checkedHosts(publicHosts ?? DEFAULT_PUBLIC_HOSTS, adminHosts);
    await insertHosts(client, HEIDEKOENIG_VENUE_ID, hosts);
    await client.query(
      "insert into app_settings (key, value) values ($1, 'true') on conflict (key) do update set value = 'true'",
      [LEGACY_HOST_IMPORT_KEY],
    );
    await client.query("commit");
    return true;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function configureVenueHosts(pool, { slug, hosts: value, adminHosts, publicHosts }) {
  const hosts = checkedHosts(value, adminHosts);
  const allowed = allowedHostSet(splitHosts(publicHosts ?? DEFAULT_PUBLIC_HOSTS));
  if (hosts.some((host) => !allowed.has(host))) {
    throw new Error("Hosts must also be configured in PUBLIC_ALLOWED_HOSTS.");
  }
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("select pg_advisory_xact_lock(hashtext('gorms_venue_hosts'))");
    const venue = await client.query("select id from venues where slug = $1", [slug]);
    if (!venue.rows[0]) throw new Error("Venue does not exist.");
    await insertHosts(client, venue.rows[0].id, hosts);
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
