/**
 * Signed OAuth state parameter.
 *
 * Embeds `storeId` inside the state so the callback can recover the tenant
 * from a cryptographically-verified value, never from a separate cookie.
 *
 * Format: base64url(`storeId:nonce`) . HMAC-SHA256
 */

import { createHmac, randomBytes, timingSafeEqual } from "crypto";

function stateSecret(): string {
  const secret =
    process.env.TOKEN_ENCRYPTION_KEY?.trim() ||
    process.env.SHOPIFY_API_SECRET?.trim() ||
    "";
  if (secret.length < 16)
    throw new Error("No signing secret available for OAuth state (TOKEN_ENCRYPTION_KEY or SHOPIFY_API_SECRET required)");
  return secret;
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

/** Returns a signed state token carrying `storeId` and a 16-byte nonce. */
export function createOAuthState(storeId: string): string {
  const nonce = randomBytes(16).toString("hex");
  const body = `${storeId.trim()}:${nonce}`;
  const secret = stateSecret();
  const sig = sign(body, secret);
  return `${Buffer.from(body, "utf8").toString("base64url")}.${sig}`;
}

export type ParsedOAuthState = { storeId: string; nonce: string };

/**
 * Verifies the HMAC and returns `{ storeId, nonce }`.
 * Returns `null` if the token is missing, malformed, or forged.
 */
export function parseOAuthState(raw: string | null | undefined): ParsedOAuthState | null {
  if (!raw?.trim()) return null;
  let secret: string;
  try {
    secret = stateSecret();
  } catch {
    return null;
  }

  const dotIdx = raw.lastIndexOf(".");
  if (dotIdx <= 0) return null;
  const encoded = raw.slice(0, dotIdx);
  const signature = raw.slice(dotIdx + 1);

  let body: string;
  try {
    body = Buffer.from(encoded, "base64url").toString("utf8");
  } catch {
    return null;
  }

  const expected = sign(body, secret);
  try {
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }

  const colonIdx = body.indexOf(":");
  if (colonIdx <= 0) return null;
  const storeId = body.slice(0, colonIdx).trim();
  const nonce = body.slice(colonIdx + 1);
  if (!storeId || !nonce) return null;
  return { storeId, nonce };
}
