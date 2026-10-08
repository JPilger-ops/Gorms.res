export const HEIDEKOENIG_VENUE_ID = "00000000-0000-4000-8000-000000000001";
export const LEGACY_HOST_IMPORT_KEY = "venue_hosts_legacy_import_completed";
export const DEFAULT_PUBLIC_HOSTS = "heidekönig.gorms.de,xn--heideknig-57a.gorms.de";

export function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function reservationRetentionDays(venueId, value, environmentValue) {
  const fallback = venueId === HEIDEKOENIG_VENUE_ID ? positiveInteger(environmentValue, 30) : 30;
  return positiveInteger(value, fallback);
}
