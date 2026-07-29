/**
 * B1 attack simulation — every previously working tenant-spoof exploit.
 *
 * Success criterion: none may resolve VICTIM_STORE for HTML/RSC tenant context
 * (resolveActiveStoreId / tryResolveActiveStoreId) or stamp victim as the
 * authenticated shop via middleware from unverified inputs.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SignJWT } from "jose";
import { NextRequest } from "next/server";
import { middleware } from "@/middleware";
import {
  AUTHENTICATED_FLAG_HEADER,
  AUTHENTICATED_SHOP_HEADER,
} from "@/lib/api/route-auth";
import { ACTIVE_STORE_COOKIE } from "@/lib/store/context";
import {
  createTenantBindingValue,
  TENANT_BINDING_COOKIE,
} from "@/lib/store/tenant-binding";
import { TenantIsolationError } from "@/lib/store/verified-tenant";

const API_KEY = "attack-sim-client-id";
const API_SECRET = "attack-sim-app-secret-32b";
const ATTACKER_SHOP = "attacker.myshopify.com";
const VICTIM_SHOP = "victim.myshopify.com";
const ATTACKER_STORE = "store-attacker";
const VICTIM_STORE = "store-victim";

const headerBag = new Map<string, string>();
const cookieBag = new Map<string, string>();

vi.mock("next/headers", () => ({
  headers: async () => ({
    get: (name: string) => headerBag.get(name.toLowerCase()) ?? null,
  }),
  cookies: async () => ({
    get: (name: string) => {
      const value = cookieBag.get(name);
      return value != null ? { name, value } : undefined;
    },
  }),
}));

vi.mock("@/lib/db/shopify", () => ({
  getActiveStoreIdForShopDomain: vi.fn(),
  getInstallationForStore: vi.fn(),
}));

vi.mock("@/lib/simulation-stores/db", () => ({
  getSimulationStoreById: vi.fn().mockResolvedValue(null),
}));

import {
  getActiveStoreIdForShopDomain,
  getInstallationForStore,
} from "@/lib/db/shopify";
import {
  resolveActiveStoreId,
  tryResolveActiveStoreId,
  UnresolvedStoreContextError,
} from "@/lib/store/context";

const getStore = vi.mocked(getActiveStoreIdForShopDomain);
const getInstall = vi.mocked(getInstallationForStore);

function hmacKey(secret: string): Uint8Array {
  const bytes = new Uint8Array(secret.length);
  for (let i = 0; i < secret.length; i += 1) bytes[i] = secret.charCodeAt(i);
  return bytes;
}

async function signSession(shop: string, secret = API_SECRET): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({
    dest: `https://${shop}`,
    aud: API_KEY,
    sub: "1",
    sid: "sid-1",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(now)
    .setNotBefore(now - 5)
    .setExpirationTime(now + 60)
    .sign(hmacKey(secret));
}

function setHeader(name: string, value: string) {
  headerBag.set(name.toLowerCase(), value);
}

function clearIdentity() {
  headerBag.clear();
  cookieBag.clear();
}

function seedMerchantDb() {
  getStore.mockImplementation(async (shop: string) => {
    if (shop === ATTACKER_SHOP) return ATTACKER_STORE;
    if (shop === VICTIM_SHOP) return VICTIM_STORE;
    return null;
  });
  getInstall.mockImplementation(async (storeId: string) => {
    if (storeId === ATTACKER_STORE) {
      return { shop_domain: ATTACKER_SHOP } as Awaited<
        ReturnType<typeof getInstallationForStore>
      >;
    }
    if (storeId === VICTIM_STORE) {
      return { shop_domain: VICTIM_SHOP } as Awaited<
        ReturnType<typeof getInstallationForStore>
      >;
    }
    return null;
  });
}

/** Apply only headers middleware would stamp after a document request. */
function applyMiddlewareRequestHeaders(response: Response) {
  const shop = response.headers.get(
    `x-middleware-request-${AUTHENTICATED_SHOP_HEADER}`,
  );
  const flag = response.headers.get(
    `x-middleware-request-${AUTHENTICATED_FLAG_HEADER}`,
  );
  const embedded = response.headers.get("x-middleware-request-x-storepilot-embedded");
  const cspHint = response.headers.get("x-middleware-request-x-storepilot-csp-shop");
  const legacy = response.headers.get("x-middleware-request-x-storepilot-shop-domain");

  if (shop) setHeader(AUTHENTICATED_SHOP_HEADER, shop);
  if (flag) setHeader(AUTHENTICATED_FLAG_HEADER, flag);
  if (embedded) setHeader("x-storepilot-embedded", embedded);
  if (cspHint) setHeader("x-storepilot-csp-shop", cspHint);
  // Legacy header must never be re-stamped by middleware after strip.
  if (legacy) setHeader("x-storepilot-shop-domain", legacy);
}

describe("B1 attack simulation — foreign store_id must never resolve", () => {
  beforeEach(() => {
    clearIdentity();
    seedMerchantDb();
    process.env.SHOPIFY_API_KEY = API_KEY;
    process.env.SHOPIFY_API_SECRET = API_SECRET;
    process.env.NODE_ENV = "production";
    delete process.env.STOREPILOT_ALLOW_DEMO;
  });

  afterEach(() => {
    clearIdentity();
    delete process.env.SHOPIFY_API_KEY;
    delete process.env.SHOPIFY_API_SECRET;
    delete process.env.STOREPILOT_ALLOW_DEMO;
  });

  it("ATTACK 1 — forged ?shop=victim on HTML does not resolve victim store", async () => {
    const mw = await middleware(
      new NextRequest(
        `https://app.example.com/?shop=${VICTIM_SHOP}&embedded=1`,
      ),
    );
    // B1-A: unauthenticated embedded HTML gets redirected (not served).
    expect([301, 302, 303, 307, 308, 401]).toContain(mw.status);
    // Only apply middleware headers if middleware passed through (not a redirect).
    if (![301, 302, 303, 307, 308].includes(mw.status)) {
      applyMiddlewareRequestHeaders(mw);
      expect(headerBag.get(AUTHENTICATED_SHOP_HEADER)).toBeUndefined();
      expect(headerBag.get(AUTHENTICATED_FLAG_HEADER)).toBeUndefined();

      await expect(resolveActiveStoreId()).rejects.toBeInstanceOf(
        UnresolvedStoreContextError,
      );
      expect(await tryResolveActiveStoreId()).toBeNull();
    }
  });

  it("ATTACK 2 — forged host (victim store handle) does not resolve victim store", async () => {
    const host = Buffer.from("admin.shopify.com/store/victim").toString("base64");
    const mw = await middleware(
      new NextRequest(`https://app.example.com/?host=${host}&embedded=1`),
    );
    // B1-A: unauthenticated embedded HTML is redirected or 401'd.
    expect([301, 302, 303, 307, 308, 401]).toContain(mw.status);

    // If by any future path the middleware returns next(), it must not carry tenant identity.
    if (![301, 302, 303, 307, 308].includes(mw.status)) {
      applyMiddlewareRequestHeaders(mw);
      expect(headerBag.get(AUTHENTICATED_SHOP_HEADER)).toBeUndefined();

      await expect(resolveActiveStoreId()).rejects.toBeInstanceOf(
        UnresolvedStoreContextError,
      );
      expect(await tryResolveActiveStoreId()).toBeNull();
    }
  });

  it("ATTACK 3 — forged forwarded shop headers do not resolve victim store", async () => {
    const mw = await middleware(
      new NextRequest("https://app.example.com/", {
        headers: {
          "x-storepilot-authenticated-shop": VICTIM_SHOP,
          "x-storepilot-authenticated": "1",
          "x-storepilot-shop-domain": VICTIM_SHOP,
          "x-storepilot-csp-shop": VICTIM_SHOP,
        },
      }),
    );
    applyMiddlewareRequestHeaders(mw);

    expect(headerBag.get(AUTHENTICATED_SHOP_HEADER)).toBeUndefined();
    expect(headerBag.get(AUTHENTICATED_FLAG_HEADER)).toBeUndefined();
    expect(headerBag.get("x-storepilot-shop-domain")).toBeUndefined();

    await expect(resolveActiveStoreId()).rejects.toBeInstanceOf(
      UnresolvedStoreContextError,
    );
    expect(await tryResolveActiveStoreId()).toBeNull();
  });

  it("ATTACK 4 — stale ACTIVE_STORE_COOKIE for victim does not resolve victim in production", async () => {
    cookieBag.set(ACTIVE_STORE_COOKIE, VICTIM_STORE);

    await expect(resolveActiveStoreId()).rejects.toBeInstanceOf(
      UnresolvedStoreContextError,
    );
    expect(await tryResolveActiveStoreId()).toBeNull();
  });

  it("ATTACK 5 — forged / tampered tenant binding cookie does not resolve victim", async () => {
    const legit = createTenantBindingValue(ATTACKER_STORE, ATTACKER_SHOP);
    expect(legit).toBeTruthy();
    const body = Buffer.from(`${VICTIM_STORE}:${VICTIM_SHOP}`, "utf8").toString(
      "base64url",
    );
    cookieBag.set(TENANT_BINDING_COOKIE, `${body}.${legit!.split(".")[1]}`);
    cookieBag.set(ACTIVE_STORE_COOKIE, VICTIM_STORE);

    await expect(resolveActiveStoreId()).rejects.toBeInstanceOf(
      UnresolvedStoreContextError,
    );
    expect(await tryResolveActiveStoreId()).toBeNull();
  });

  it("ATTACK 6 — shop switching: attacker session + victim cookie → blocked (no victim HTML)", async () => {
    const token = await signSession(ATTACKER_SHOP);
    const mw = await middleware(
      new NextRequest(
        `https://app.example.com/?shop=${VICTIM_SHOP}&id_token=${token}&embedded=1`,
      ),
    );
    applyMiddlewareRequestHeaders(mw);
    cookieBag.set(ACTIVE_STORE_COOKIE, VICTIM_STORE);

    // Session stamps attacker, not victim URL shop.
    expect(headerBag.get(AUTHENTICATED_SHOP_HEADER)).toBe(ATTACKER_SHOP);

    await expect(resolveActiveStoreId()).rejects.toBeInstanceOf(TenantIsolationError);
    expect(await tryResolveActiveStoreId()).toBeNull();
  });

  it("ATTACK 7 — mismatched session vs installation shop_domain → 403, no victim store", async () => {
    setHeader(AUTHENTICATED_FLAG_HEADER, "1");
    setHeader(AUTHENTICATED_SHOP_HEADER, ATTACKER_SHOP);
    // DB corruption / swap: attacker shop maps to attacker store, but install row claims victim.
    getStore.mockResolvedValue(ATTACKER_STORE);
    getInstall.mockResolvedValue({
      shop_domain: VICTIM_SHOP,
    } as Awaited<ReturnType<typeof getInstallationForStore>>);

    await expect(resolveActiveStoreId()).rejects.toBeInstanceOf(TenantIsolationError);
    expect(await tryResolveActiveStoreId()).toBeNull();
  });

  it("ATTACK 8 — stale binding (no live session): binding alone no longer authorizes → UnresolvedStoreContextError", async () => {
    // B1-A: a signed binding without an active session must never resolve a tenant.
    const binding = createTenantBindingValue(ATTACKER_STORE, ATTACKER_SHOP);
    expect(binding).toBeTruthy();
    cookieBag.set(TENANT_BINDING_COOKIE, binding!);
    // Even if DB would return a different shop, there is no session so resolution fails first.
    getInstall.mockResolvedValue({
      shop_domain: VICTIM_SHOP,
    } as Awaited<ReturnType<typeof getInstallationForStore>>);

    await expect(resolveActiveStoreId()).rejects.toBeInstanceOf(
      UnresolvedStoreContextError,
    );
    expect(await tryResolveActiveStoreId()).toBeNull();
  });

  it("ATTACK 9 — unauthenticated request never resolves a live merchant store", async () => {
    await expect(resolveActiveStoreId()).rejects.toBeInstanceOf(
      UnresolvedStoreContextError,
    );
    expect(await tryResolveActiveStoreId()).toBeNull();
  });

  it("ATTACK 10 — combined classic B1 vector (?shop= + host + forged headers + victim cookie)", async () => {
    const host = Buffer.from("admin.shopify.com/store/victim").toString("base64");
    const mw = await middleware(
      new NextRequest(
        `https://app.example.com/?shop=${VICTIM_SHOP}&host=${host}&embedded=1`,
        {
          headers: {
            "x-storepilot-authenticated-shop": VICTIM_SHOP,
            "x-storepilot-authenticated": "1",
            "x-storepilot-shop-domain": VICTIM_SHOP,
          },
        },
      ),
    );
    applyMiddlewareRequestHeaders(mw);
    cookieBag.set(ACTIVE_STORE_COOKIE, VICTIM_STORE);

    const resolved = await tryResolveActiveStoreId();
    expect(resolved).not.toBe(VICTIM_STORE);
    expect(resolved).toBeNull();
  });

  it("CONTROL — verified attacker session resolves only attacker store (not victim)", async () => {
    const token = await signSession(ATTACKER_SHOP);
    const mw = await middleware(
      new NextRequest(
        `https://app.example.com/?shop=${VICTIM_SHOP}&id_token=${token}&embedded=1`,
      ),
    );
    applyMiddlewareRequestHeaders(mw);

    expect(await resolveActiveStoreId()).toBe(ATTACKER_STORE);
    expect(await tryResolveActiveStoreId()).not.toBe(VICTIM_STORE);
  });

  it("CONTROL — signed attacker binding alone (no session) no longer authorizes any store (B1-A)", async () => {
    // B1-A: binding cookie alone is not merchant authentication.
    // A live Shopify session is required; without one, any binding is rejected.
    const binding = createTenantBindingValue(ATTACKER_STORE, ATTACKER_SHOP);
    expect(binding).toBeTruthy();
    cookieBag.set(TENANT_BINDING_COOKIE, binding!);

    await expect(resolveActiveStoreId()).rejects.toBeInstanceOf(UnresolvedStoreContextError);
    expect(await tryResolveActiveStoreId()).toBeNull();
  });

  it("API — forged ?shop=victim without token still 401 (no data path)", async () => {
    const mw = await middleware(
      new NextRequest(`https://app.example.com/api/dashboard?shop=${VICTIM_SHOP}`),
    );
    expect(mw.status).toBe(401);
  });
});
