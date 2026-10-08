import type { Pool } from "pg";
export function cleanupFloorplans(
  pool: Pool,
  options: { uploadDir: string; now?: Date },
): Promise<{ retiredAssets: number; orphanFiles: number; protectedAssets: number }>;
