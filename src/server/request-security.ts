import { createHash } from "node:crypto";
import { headers } from "next/headers";

function firstForwardedFor(value: string | null) {
  return value?.split(",")[0]?.trim() || "unknown";
}

function hashIdentifier(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 32);
}

export async function getClientRateLimitKey(scope: string) {
  const headerList = await headers();
  const forwardedFor = firstForwardedFor(headerList.get("x-forwarded-for"));
  const realIp = headerList.get("x-real-ip")?.trim();
  const candidate = realIp || forwardedFor;

  return `${scope}:${hashIdentifier(candidate)}`;
}
