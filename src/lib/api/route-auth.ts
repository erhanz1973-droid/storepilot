import { getBearerToken } from "@/lib/shopify/session-token";

/** Request header carrying the merchant shop verified from a session token. */
export const AUTHENTICATED_SHOP_HEADER = "x-storepilot-shop-domain";
/** Request header flag set once a request passed merchant session verification. */
export const AUTHENTICATED_FLAG_HEADER = "x-storepilot-authenticated";

/**
 * API paths that are intentionally public and must NOT require an embedded
 * merchant session token. Each has its own authentication where relevant:
 *  - OAuth start/callback: Shopify HMAC / OAuth state cookies
 *  - webhooks: Shopify webhook HMAC
 *  - bootstrap: performs authenticate.admin() itself (token exchange / bounce)
 *  - cron: CRON_SECRET bearer
 *  - internal: STOREPILOT_INTERNAL_SECRET / SMOKE_SECRET bearer
 *  - dev/validation: developer-tools gate (404 in production unless enabled)
 *  - demo: switches to synthetic demo store only
 *  - debug: deploy metadata only (no merchant data)
 */
const PUBLIC_API_PREFIXES: readonly string[] = [
  "/api/shopify/auth",
  "/api/shopify/callback",
  "/api/shopify/bootstrap",
  "/api/shopify/webhooks",
  "/api/ga4/auth",
  "/api/ga4/callback",
  "/api/google/auth",
  "/api/google/callback",
  "/api/meta/auth",
  "/api/meta/callback",
  "/api/meta/validation",
  "/api/validation",
  "/api/cron",
  "/api/internal",
  "/api/dev",
  "/api/debug",
  // Post-OAuth account/property selection runs top-level (outside the Shopify
  // Admin iframe), so no embedded session token exists. These routes
  // self-authenticate with the short-lived random pending-OAuth session UUID.
  // Only options/connect are public — the parent /api/*/accounts prefixes
  // (e.g. DELETE disconnect) stay session-token protected.
  "/api/meta/accounts/options",
  "/api/meta/accounts/connect",
  "/api/google/accounts/options",
  "/api/google/accounts/connect",
  "/api/ga4/accounts/options",
  "/api/ga4/accounts/connect",
];

export function isApiPath(pathname: string): boolean {
  return pathname === "/api" || pathname.startsWith("/api/");
}

export function isPublicApiPath(pathname: string): boolean {
  // Demo routes are reachable so production can answer 404 from the handler.
  // Handlers must never return synthetic merchant metrics when demo is disabled.
  if (pathname === "/api/demo" || pathname.startsWith("/api/demo/")) {
    return true;
  }
  return PUBLIC_API_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/**
 * Trusted server-to-server callers (smoke tests, monitoring, cron, internal
 * tooling) may reach protected endpoints with a shared secret instead of an
 * embedded session token. Holding the secret is itself the authorization.
 */
export function hasServiceSecret(request: Request): boolean {
  const token = getBearerToken(request) ?? request.headers.get("x-smoke-secret")?.trim() ?? "";
  if (!token) return false;
  const secrets = [
    process.env.STOREPILOT_INTERNAL_SECRET,
    process.env.SMOKE_SECRET,
    process.env.CRON_SECRET,
  ]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));
  return secrets.includes(token);
}
