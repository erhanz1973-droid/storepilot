import { headers } from "next/headers";

export const MARKETING_SITE_URL =
  process.env.NEXT_PUBLIC_MARKETING_URL?.replace(/\/$/, "") ?? "https://storepilotai.pro";

export const MARKETING_SUPPORT_EMAIL = "support@storepilotai.pro";

/** Hostnames that serve the public marketing site (not the embedded Shopify app). */
const DEFAULT_MARKETING_HOSTS = ["storepilotai.pro", "www.storepilotai.pro"] as const;

function configuredMarketingHosts(): Set<string> {
  const fromEnv =
    process.env.STOREPILOT_MARKETING_HOSTS?.split(",")
      .map((h) => h.trim().toLowerCase())
      .filter(Boolean) ?? [];
  return new Set([...DEFAULT_MARKETING_HOSTS, ...fromEnv]);
}

/** Normalize a Host / :authority value (strip port, lowercase). */
export function normalizeHost(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  // x-forwarded-host may be a comma-separated list — use the first (client-facing) host.
  const first = trimmed.split(",")[0]?.trim() ?? "";
  if (!first) return null;
  return first.split(":")[0]?.toLowerCase() ?? null;
}

/**
 * Resolve the public hostname for the current request.
 * Checks proxy headers first (Railway, Cloudflare), then Host.
 *
 * Order matters: x-forwarded-host reflects the domain the client requested
 * when the app sits behind a reverse proxy.
 */
export function resolveRequestHost(headerList: Headers): string | null {
  const candidates = [
    headerList.get("x-forwarded-host"),
    headerList.get("x-original-host"),
    headerList.get("cf-connecting-host"),
    headerList.get("host"),
  ];

  for (const candidate of candidates) {
    const normalized = normalizeHost(candidate);
    if (normalized) return normalized;
  }

  return null;
}

export function isMarketingHost(host: string | null | undefined): boolean {
  const normalized = normalizeHost(host);
  if (!normalized) return false;
  return configuredMarketingHosts().has(normalized);
}

/**
 * True when the request is served on the public marketing domain.
 * Uses server headers() directly — does not depend on middleware.
 */
export async function isMarketingRequest(): Promise<boolean> {
  const headerList = await headers();
  const host = resolveRequestHost(headerList);
  return isMarketingHost(host);
}

export const MARKETING_PATHS = new Set(["/", "/privacy", "/terms", "/contact"]);

export function isMarketingPath(pathname: string): boolean {
  return MARKETING_PATHS.has(pathname);
}
