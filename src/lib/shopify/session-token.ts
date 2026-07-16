import { jwtVerify } from "jose";
import { normalizeShopDomain } from "@/lib/store/embedded-shop";

/**
 * Shopify embedded App Bridge session-token verification.
 *
 * App Bridge (app-bridge.js) automatically attaches a short-lived OpenID Connect
 * session token as `Authorization: Bearer <jwt>` to every `fetch()` an embedded
 * app makes to its own backend. This module verifies that JWT the exact same way
 * @shopify/shopify-api's `decodeSessionToken` does (HS256 over the app secret,
 * audience === client id), so a token accepted by `authenticate.admin()` is also
 * accepted here.
 *
 * Kept dependency-free of node:crypto so it can run in Edge middleware.
 */

export type VerifiedSessionToken = {
  /** Normalized shop domain, e.g. "example.myshopify.com". */
  shop: string;
  /** Subject — the Shopify user id the token was issued for. */
  userId: string;
  /** Raw decoded JWT claims. */
  payload: Record<string, unknown>;
};

/** Thrown when a session token is missing, malformed, expired, or forged. */
export class InvalidSessionTokenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidSessionTokenError";
  }
}

const CLOCK_TOLERANCE_SECONDS = 10;

/**
 * Byte encoding used by @shopify/shopify-api's getHMACKey — charCode per byte.
 * Matches Shopify's signing key derivation exactly for parity with the SDK.
 */
function hmacKey(secret: string): Uint8Array {
  const bytes = new Uint8Array(secret.length);
  for (let i = 0; i < secret.length; i += 1) {
    bytes[i] = secret.charCodeAt(i);
  }
  return bytes;
}

/** Extract the bearer token from an incoming request's Authorization header. */
export function getBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization") ?? "";
  if (!header.toLowerCase().startsWith("bearer ")) return null;
  const token = header.slice(7).trim();
  return token.length > 0 ? token : null;
}

function shopFromClaims(payload: Record<string, unknown>): string | null {
  // `dest` is the shop admin origin, e.g. "https://example.myshopify.com".
  const dest = typeof payload.dest === "string" ? payload.dest : null;
  const iss = typeof payload.iss === "string" ? payload.iss : null;
  for (const claim of [dest, iss]) {
    if (!claim) continue;
    try {
      const host = new URL(claim).hostname;
      const normalized = normalizeShopDomain(host);
      if (normalized) return normalized;
    } catch {
      // fall through to next claim
    }
  }
  return null;
}

/**
 * Verify a Shopify session token JWT.
 * Throws {@link InvalidSessionTokenError} for any missing/invalid/expired token.
 */
export async function verifyShopifySessionToken(
  token: string,
): Promise<VerifiedSessionToken> {
  const apiSecret = process.env.SHOPIFY_API_SECRET;
  // App Bridge stamps `aud` with the public client id; accept whichever env the
  // deployment uses (they are the same client id in a correct configuration).
  const acceptedAudiences = [
    process.env.SHOPIFY_API_KEY,
    process.env.NEXT_PUBLIC_SHOPIFY_API_KEY,
  ]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));
  if (!apiSecret || acceptedAudiences.length === 0) {
    throw new InvalidSessionTokenError("Shopify OAuth is not configured");
  }

  let payload: Record<string, unknown>;
  try {
    const result = await jwtVerify(token, hmacKey(apiSecret), {
      algorithms: ["HS256"],
      clockTolerance: CLOCK_TOLERANCE_SECONDS,
    });
    payload = result.payload as Record<string, unknown>;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new InvalidSessionTokenError(`Session token verification failed: ${message}`);
  }

  if (typeof payload.aud !== "string" || !acceptedAudiences.includes(payload.aud)) {
    throw new InvalidSessionTokenError("Session token audience does not match this app");
  }

  const shop = shopFromClaims(payload);
  if (!shop) {
    throw new InvalidSessionTokenError("Session token is missing a valid shop claim");
  }

  return {
    shop,
    userId: typeof payload.sub === "string" ? payload.sub : "",
    payload,
  };
}
