import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SignJWT } from "jose";
import { NextRequest } from "next/server";
import { middleware } from "@/middleware";

const API_KEY = "middleware-client-id";
const API_SECRET = "middleware-app-secret";
const SHOP = "merchant-a.myshopify.com";

function hmacKey(secret: string): Uint8Array {
  const bytes = new Uint8Array(secret.length);
  for (let i = 0; i < secret.length; i += 1) bytes[i] = secret.charCodeAt(i);
  return bytes;
}

async function signToken(options?: {
  dest?: string;
  secret?: string;
  expiresInSeconds?: number;
}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({
    dest: options?.dest ?? `https://${SHOP}`,
    aud: API_KEY,
    sub: "7",
    sid: "sid-7",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(now)
    .setNotBefore(now - 5)
    .setExpirationTime(now + (options?.expiresInSeconds ?? 60))
    .sign(hmacKey(options?.secret ?? API_SECRET));
}

function apiRequest(path: string, headers?: Record<string, string>): NextRequest {
  return new NextRequest(`https://app.example.com${path}`, {
    method: "GET",
    headers,
  });
}

describe("middleware API authentication", () => {
  beforeEach(() => {
    process.env.SHOPIFY_API_KEY = API_KEY;
    process.env.SHOPIFY_API_SECRET = API_SECRET;
    process.env.SMOKE_SECRET = "smoke-secret-value";
  });

  afterEach(() => {
    delete process.env.SHOPIFY_API_KEY;
    delete process.env.SHOPIFY_API_SECRET;
    delete process.env.SMOKE_SECRET;
  });

  it("returns 401 for a protected route without a session token", async () => {
    const response = await middleware(apiRequest("/api/dashboard"));
    expect(response.status).toBe(401);
    const body = (await response.json()) as { error: string; reason: string };
    expect(body.error).toBe("Unauthorized");
    expect(body.reason).toBe("missing_session_token");
  });

  it("returns 401 for an expired session token", async () => {
    const token = await signToken({ expiresInSeconds: -3600 });
    const response = await middleware(
      apiRequest("/api/dashboard", { Authorization: `Bearer ${token}` }),
    );
    expect(response.status).toBe(401);
    const body = (await response.json()) as { reason: string };
    expect(body.reason).toBe("invalid_session_token");
  });

  it("returns 401 for a forged session token", async () => {
    const token = await signToken({ secret: "wrong-secret" });
    const response = await middleware(
      apiRequest("/api/dashboard", { Authorization: `Bearer ${token}` }),
    );
    expect(response.status).toBe(401);
  });

  it("rejects ?shop= spoofing without a valid session token", async () => {
    const response = await middleware(
      apiRequest(`/api/dashboard?shop=${SHOP}&embedded=1`),
    );
    expect(response.status).toBe(401);
  });

  it("allows a valid session token through and stamps the verified shop", async () => {
    const token = await signToken();
    const response = await middleware(
      apiRequest("/api/dashboard", { Authorization: `Bearer ${token}` }),
    );
    // NextResponse.next() resolves to status 200 with rewritten request headers.
    expect(response.status).toBe(200);
    // The authenticated shop is forwarded as a request header on the rewritten request.
    const requestHeaders = response.headers.get("x-middleware-request-x-storepilot-shop-domain");
    expect(requestHeaders).toBe(SHOP);
    expect(response.headers.get("x-middleware-request-x-storepilot-authenticated")).toBe("1");
  });

  it("allows a trusted service secret through", async () => {
    const response = await middleware(
      apiRequest("/api/dashboard", { Authorization: "Bearer smoke-secret-value" }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-request-x-storepilot-authenticated")).toBe(
      "service",
    );
  });

  it("leaves public routes (webhooks, oauth, bootstrap, cron) unguarded by session tokens", async () => {
    for (const path of [
      "/api/shopify/webhooks",
      "/api/shopify/auth",
      "/api/shopify/bootstrap",
      "/api/ga4/callback",
      "/api/cron/ga4-sync",
      "/api/debug",
    ]) {
      const response = await middleware(apiRequest(path));
      // Public paths pass through middleware with 200 (handler does its own auth).
      expect(response.status, path).toBe(200);
      expect(response.headers.get("content-type") ?? "").not.toContain("application/json");
    }
  });
});
