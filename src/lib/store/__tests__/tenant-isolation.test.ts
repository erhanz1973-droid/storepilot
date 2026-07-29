import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createTenantBindingValue,
  parseTenantBindingCookie,
} from "@/lib/store/tenant-binding";
import {
  assertStoreMatchesVerifiedShop,
  resolveStoreIdFromVerifiedTenant,
  TenantIsolationError,
} from "@/lib/store/verified-tenant";

vi.mock("@/lib/db/shopify", () => ({
  getActiveStoreIdForShopDomain: vi.fn(),
  getInstallationForStore: vi.fn(),
}));

import {
  getActiveStoreIdForShopDomain,
  getInstallationForStore,
} from "@/lib/db/shopify";

const getStore = vi.mocked(getActiveStoreIdForShopDomain);
const getInstall = vi.mocked(getInstallationForStore);

describe("tenant binding cookie", () => {
  beforeEach(() => {
    process.env.SHOPIFY_API_SECRET = "tenant-binding-secret-key!!";
  });

  afterEach(() => {
    delete process.env.SHOPIFY_API_SECRET;
    delete process.env.TOKEN_ENCRYPTION_KEY;
  });

  it("round-trips a signed store↔shop binding", () => {
    const raw = createTenantBindingValue("store-1", "merchant-a.myshopify.com");
    expect(raw).toBeTruthy();
    const parsed = parseTenantBindingCookie(raw);
    expect(parsed).toEqual({
      storeId: "store-1",
      shopDomain: "merchant-a.myshopify.com",
    });
  });

  it("rejects a forged binding signature", () => {
    const raw = createTenantBindingValue("store-1", "merchant-a.myshopify.com");
    expect(raw).toBeTruthy();
    const tampered = `${raw!.split(".")[0]}.AAAAAAAAAAAAAAAAAAAAAA`;
    expect(parseTenantBindingCookie(tampered)).toBeNull();
  });

  it("rejects binding for a swapped shop claim", () => {
    const raw = createTenantBindingValue("store-1", "merchant-a.myshopify.com");
    const body = Buffer.from("store-1:victim.myshopify.com", "utf8").toString("base64url");
    const forged = `${body}.${raw!.split(".")[1]}`;
    expect(parseTenantBindingCookie(forged)).toBeNull();
  });
});

describe("verified tenant resolution", () => {
  beforeEach(() => {
    getStore.mockReset();
    getInstall.mockReset();
  });

  it("resolves store from authenticated session shop and asserts domain match", async () => {
    getStore.mockResolvedValue("store-a");
    getInstall.mockResolvedValue({
      shop_domain: "merchant-a.myshopify.com",
    } as Awaited<ReturnType<typeof getInstallationForStore>>);

    const result = await resolveStoreIdFromVerifiedTenant({
      authenticatedShop: "merchant-a.myshopify.com",
      authFlag: "1",
      binding: null,
    });

    expect(result).toEqual({
      storeId: "store-a",
      shopDomain: "merchant-a.myshopify.com",
      source: "session",
    });
  });

  it("rejects when installation shop_domain does not match authenticated shop", async () => {
    getInstall.mockResolvedValue({
      shop_domain: "other.myshopify.com",
    } as Awaited<ReturnType<typeof getInstallationForStore>>);

    await expect(
      assertStoreMatchesVerifiedShop("store-a", "merchant-a.myshopify.com"),
    ).rejects.toBeInstanceOf(TenantIsolationError);
  });

  it("does not use binding when session shop is present but unmapped", async () => {
    getStore.mockResolvedValue(null);
    const result = await resolveStoreIdFromVerifiedTenant({
      authenticatedShop: "unknown.myshopify.com",
      authFlag: "1",
      binding: {
        storeId: "store-victim",
        shopDomain: "victim.myshopify.com",
      },
    });
    expect(result).toBeNull();
  });

  it("B1-A: rejects signed binding without an active session — binding alone never authorizes", async () => {
    // Binding without authenticatedShop must return null, not resolve a store.
    getInstall.mockResolvedValue({
      shop_domain: "merchant-a.myshopify.com",
    } as Awaited<ReturnType<typeof getInstallationForStore>>);

    const result = await resolveStoreIdFromVerifiedTenant({
      authenticatedShop: null,
      authFlag: null,
      binding: {
        storeId: "store-a",
        shopDomain: "merchant-a.myshopify.com",
      },
    });

    expect(result).toBeNull();
  });

  it("B1-A: stale/mismatched binding without session still returns null (no throw needed)", async () => {
    // Without a session, resolution short-circuits to null before DB checks.
    getInstall.mockResolvedValue({
      shop_domain: "victim.myshopify.com",
    } as Awaited<ReturnType<typeof getInstallationForStore>>);

    const result = await resolveStoreIdFromVerifiedTenant({
      authenticatedShop: null,
      authFlag: null,
      binding: {
        storeId: "store-a",
        shopDomain: "merchant-a.myshopify.com",
      },
    });

    expect(result).toBeNull();
  });
});
