import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SignJWT } from "jose";
import {
  getBearerToken,
  InvalidSessionTokenError,
  verifyShopifySessionToken,
} from "@/lib/shopify/session-token";

const API_KEY = "test-client-id";
const API_SECRET = "test-app-secret-value";
const SHOP = "verified-shop.myshopify.com";

/** Match @shopify/shopify-api getHMACKey byte derivation. */
function hmacKey(secret: string): Uint8Array {
  const bytes = new Uint8Array(secret.length);
  for (let i = 0; i < secret.length; i += 1) bytes[i] = secret.charCodeAt(i);
  return bytes;
}

async function signToken(options?: {
  aud?: string;
  dest?: string;
  secret?: string;
  expiresInSeconds?: number;
  notBeforeSeconds?: number;
}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + (options?.expiresInSeconds ?? 60);
  const nbf = now + (options?.notBeforeSeconds ?? -10);
  return new SignJWT({
    dest: options?.dest ?? `https://${SHOP}`,
    aud: options?.aud ?? API_KEY,
    sub: "42",
    sid: "session-42",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(now)
    .setNotBefore(nbf)
    .setExpirationTime(exp)
    .sign(hmacKey(options?.secret ?? API_SECRET));
}

describe("verifyShopifySessionToken", () => {
  beforeEach(() => {
    process.env.SHOPIFY_API_KEY = API_KEY;
    process.env.SHOPIFY_API_SECRET = API_SECRET;
    delete process.env.NEXT_PUBLIC_SHOPIFY_API_KEY;
  });

  afterEach(() => {
    delete process.env.SHOPIFY_API_KEY;
    delete process.env.SHOPIFY_API_SECRET;
    delete process.env.NEXT_PUBLIC_SHOPIFY_API_KEY;
  });

  it("accepts a valid token and extracts the shop", async () => {
    const token = await signToken();
    const result = await verifyShopifySessionToken(token);
    expect(result.shop).toBe(SHOP);
    expect(result.userId).toBe("42");
  });

  it("accepts the public NEXT_PUBLIC api key as audience", async () => {
    delete process.env.SHOPIFY_API_KEY;
    process.env.NEXT_PUBLIC_SHOPIFY_API_KEY = API_KEY;
    const token = await signToken();
    await expect(verifyShopifySessionToken(token)).resolves.toMatchObject({ shop: SHOP });
  });

  it("rejects a token signed with the wrong secret (forged)", async () => {
    const token = await signToken({ secret: "attacker-secret-value" });
    await expect(verifyShopifySessionToken(token)).rejects.toBeInstanceOf(
      InvalidSessionTokenError,
    );
  });

  it("rejects a token with a mismatched audience", async () => {
    const token = await signToken({ aud: "some-other-app" });
    await expect(verifyShopifySessionToken(token)).rejects.toBeInstanceOf(
      InvalidSessionTokenError,
    );
  });

  it("rejects an expired token", async () => {
    const token = await signToken({ expiresInSeconds: -3600 });
    await expect(verifyShopifySessionToken(token)).rejects.toBeInstanceOf(
      InvalidSessionTokenError,
    );
  });

  it("rejects a malformed token", async () => {
    await expect(verifyShopifySessionToken("not-a-jwt")).rejects.toBeInstanceOf(
      InvalidSessionTokenError,
    );
  });

  it("rejects when the shop claim is invalid", async () => {
    const token = await signToken({ dest: "https://not-a-shop.example.com" });
    await expect(verifyShopifySessionToken(token)).rejects.toBeInstanceOf(
      InvalidSessionTokenError,
    );
  });

  it("fails closed when the app secret is not configured", async () => {
    const token = await signToken();
    delete process.env.SHOPIFY_API_SECRET;
    await expect(verifyShopifySessionToken(token)).rejects.toBeInstanceOf(
      InvalidSessionTokenError,
    );
  });
});

describe("getBearerToken", () => {
  it("extracts a bearer token", () => {
    const request = new Request("https://app.example.com/api/dashboard", {
      headers: { Authorization: "Bearer abc.def.ghi" },
    });
    expect(getBearerToken(request)).toBe("abc.def.ghi");
  });

  it("is case-insensitive on the scheme", () => {
    const request = new Request("https://app.example.com/api/dashboard", {
      headers: { Authorization: "bearer token123" },
    });
    expect(getBearerToken(request)).toBe("token123");
  });

  it("returns null without a bearer header", () => {
    const request = new Request("https://app.example.com/api/dashboard");
    expect(getBearerToken(request)).toBeNull();
  });
});
