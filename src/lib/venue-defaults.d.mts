export const HEIDEKOENIG_VENUE_ID: string;
export const LEGACY_HOST_IMPORT_KEY: string;
export const DEFAULT_PUBLIC_HOSTS: string;
export function positiveInteger(value: unknown, fallback: number): number;
export function reservationRetentionDays(
  venueId: string,
  value: unknown,
  environmentValue?: unknown,
): number;
