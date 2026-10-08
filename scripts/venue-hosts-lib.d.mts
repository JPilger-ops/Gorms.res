import type { Pool } from "pg";
export function importLegacyPublicHosts(
  pool: Pool,
  config?: { publicHosts?: string; adminHosts?: string },
): Promise<boolean>;
export function configureVenueHosts(
  pool: Pool,
  config: { slug: string; hosts: string; adminHosts?: string; publicHosts?: string },
): Promise<void>;
