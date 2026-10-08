export function normalizeHost(value: string): { ascii: string; unicode: string };
export function splitHosts(value: string | undefined, fallback?: string): string[];
export function allowedHostSet(hosts: string[]): Set<string>;
export function originHost(origin: string | null): string | null;
