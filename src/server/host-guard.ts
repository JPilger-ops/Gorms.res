import { headers } from "next/headers";
import { domainToASCII, domainToUnicode } from "node:url";
import { env } from "@/src/lib/env";

function splitHosts(value: string | undefined, fallback: string[]) {
  return (value ?? fallback.join(","))
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
}

function normalizeHost(host: string) {
  const withoutPort = host.trim().toLowerCase().split(":")[0] ?? "";
  const ascii = domainToASCII(withoutPort);

  return {
    ascii: ascii || withoutPort,
    unicode: domainToUnicode(ascii || withoutPort) || withoutPort,
  };
}

function allowedHostSet(hosts: string[]) {
  return new Set(
    hosts.flatMap((host) => {
      const normalized = normalizeHost(host);
      return [normalized.ascii, normalized.unicode];
    }),
  );
}

export function getAdminAllowedHosts() {
  return splitHosts(env.ADMIN_ALLOWED_HOSTS, ["login.gorms.de"]);
}

export function getPublicAllowedHosts() {
  return splitHosts(env.PUBLIC_ALLOWED_HOSTS, [
    "heidekönig.gorms.de",
    "xn--heideknig-57a.gorms.de",
  ]);
}

export async function getRequestHost() {
  const headerList = await headers();
  const forwardedHost = headerList.get("x-forwarded-host");
  const host = forwardedHost?.split(",")[0]?.trim() || headerList.get("host") || "";

  return normalizeHost(host);
}

export async function isAdminHostRequest() {
  const requestHost = await getRequestHost();
  return allowedHostSet(getAdminAllowedHosts()).has(requestHost.ascii);
}

export async function isPublicHostRequest() {
  const requestHost = await getRequestHost();
  return allowedHostSet(getPublicAllowedHosts()).has(requestHost.ascii);
}
