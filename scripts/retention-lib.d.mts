import type { Pool } from "pg";
export type RetentionCleanupResult = {
  auditLogCutoff: Date;
  auditLogsDeleted: number;
  auditLogsScrubbed: number;
  outgoingEmailsAnonymized: number;
  reservationsAnonymized: number;
  venueResults: {
    venueId: string;
    reservationRetentionDays: number;
    reservationCutoff: Date;
    reservationsAnonymized: number;
  }[];
};
export function cleanupRetention(
  pool: Pool,
  options?: {
    now?: Date;
    venueId?: string;
    userId?: string;
    reservationFallback?: unknown;
    auditFallback?: unknown;
  },
): Promise<RetentionCleanupResult>;
