import { headers } from "next/headers";
import { env } from "@/src/lib/env";
import { allowedHostSet, normalizeHost, originHost, splitHosts } from "@/src/lib/hostnames.mjs";
import { resolvePublicVenue } from "@/src/server/venues";

function originHostAllowed(origin: string | null, hosts: string[]) {
  const host = originHost(origin);
  return host === null || allowedHostSet(hosts).has(host);
}

export function getAdminAllowedHosts() {
  return splitHosts(env.ADMIN_ALLOWED_HOSTS, "login.gorms.de");
}

export function getPublicAllowedHosts() {
  return splitHosts(env.PUBLIC_ALLOWED_HOSTS, "heidekönig.gorms.de,xn--heideknig-57a.gorms.de");
}

export async function getRequestHost() {
  const headerList = await headers();
  const forwardedHost = headerList.get("x-forwarded-host");
  const host = forwardedHost?.split(",")[0]?.trim() || headerList.get("host") || "";

  return normalizeHost(host);
}

export async function isAdminHostRequest() {
  const headerList = await headers();
  const requestHost = await getRequestHost();
  const allowedHosts = getAdminAllowedHosts();

  return (
    allowedHostSet(allowedHosts).has(requestHost.ascii) &&
    originHostAllowed(headerList.get("origin"), allowedHosts)
  );
}

export async function isPublicHostRequest() {
  return Boolean(await getPublicRequestVenue());
}

export async function getPublicRequestVenue() {
  const headerList = await headers();
  const requestHost = await getRequestHost();
  return resolvePublicVenue({
    host: requestHost.ascii,
    origin: headerList.get("origin"),
    publicHosts: getPublicAllowedHosts(),
    adminHosts: getAdminAllowedHosts(),
  });
}
