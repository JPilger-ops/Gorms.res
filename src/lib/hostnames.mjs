import { domainToASCII, domainToUnicode } from "node:url";

export function normalizeHost(value) {
  const input = value.trim().toLowerCase();
  if (/[\s/\\?#@,]/.test(input)) return { ascii: "", unicode: "" };
  const match = input.match(/^([^:]+)(?::([0-9]{1,5}))?$/);
  if (!match || (match[2] && Number(match[2]) > 65535)) return { ascii: "", unicode: "" };
  const host = match[1];
  const ascii = domainToASCII(host);
  if (
    !ascii ||
    !/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(ascii)
  ) {
    return { ascii: "", unicode: "" };
  }
  return { ascii, unicode: domainToUnicode(ascii) };
}

export function splitHosts(value, fallback = "") {
  return (value ?? fallback)
    .split(",")
    .map((host) => host.trim())
    .filter(Boolean);
}

export function allowedHostSet(hosts) {
  return new Set(hosts.map((host) => normalizeHost(host).ascii).filter(Boolean));
}

export function originHost(origin) {
  if (!origin) return null;
  try {
    return normalizeHost(new URL(origin).host).ascii || "";
  } catch {
    return "";
  }
}
