import { cookies, headers } from "next/headers";
import { getActiveStoreIdForShopDomain, getInstallationForStore } from "@/lib/db/shopify";
import {
  AUTHENTICATED_FLAG_HEADER,
  AUTHENTICATED_SHOP_HEADER,
} from "@/lib/api/route-auth";
import { normalizeShopDomain } from "@/lib/store/embedded-shop";
import {
  parseTenantBindingCookie,
  TENANT_BINDING_COOKIE,
  type TenantBinding,
} from "@/lib/store/tenant-binding";

export class TenantIsolationError extends Error {
  readonly status = 403;
  constructor(message = "Store does not match authenticated Shopify session") {
    super(message);
    this.name = "TenantIsolationError";
  }
}

export type VerifiedTenantContext = {
  /** Normalized shop from a verified session token (middleware) or null. */
  authenticatedShop: string | null;
  /** How middleware authenticated this request. */
  authFlag: "1" | "service" | null;
  /** Signed binding set only after authenticate.admin / OAuth. */
  binding: TenantBinding | null;
};

/**
 * Read verified tenant signals only — never URL shop / host / unverified headers.
 */
export async function readVerifiedTenantContext(): Promise<VerifiedTenantContext> {
  const headerStore = await headers();
  const authFlagRaw = headerStore.get(AUTHENTICATED_FLAG_HEADER);
  const authFlag =
    authFlagRaw === "1" || authFlagRaw === "service" ? authFlagRaw : null;

  // Only trust the authenticated-shop header when middleware stamped the flag.
  const authenticatedShop =
    authFlag === "1"
      ? normalizeShopDomain(headerStore.get(AUTHENTICATED_SHOP_HEADER))
      : null;

  const cookieStore = await cookies();
  const binding = parseTenantBindingCookie(cookieStore.get(TENANT_BINDING_COOKIE)?.value);

  return { authenticatedShop, authFlag, binding };
}

/**
 * Assert installation.shop_domain matches the authenticated / bound shop.
 * Throws TenantIsolationError (403 semantics) on mismatch.
 */
export async function assertStoreMatchesVerifiedShop(
  storeId: string,
  verifiedShop: string,
): Promise<void> {
  const installation = await getInstallationForStore(storeId);
  if (!installation) {
    throw new TenantIsolationError("No active installation for store");
  }
  const storeShop = normalizeShopDomain(installation.shop_domain);
  const expected = normalizeShopDomain(verifiedShop);
  if (!storeShop || !expected || storeShop !== expected) {
    throw new TenantIsolationError(
      `Store shop_domain mismatch: expected ${expected}, got ${storeShop}`,
    );
  }
}

/**
 * Resolve store_id strictly from verified session shop or signed tenant binding.
 * Never uses ?shop=, host, or unverified forwarded headers.
 */
export async function resolveStoreIdFromVerifiedTenant(
  ctx: VerifiedTenantContext,
): Promise<{ storeId: string; shopDomain: string; source: "session" | "binding" | "service_binding" } | null> {
  if (ctx.authenticatedShop) {
    const storeId = await getActiveStoreIdForShopDomain(ctx.authenticatedShop);
    if (!storeId) return null;
    await assertStoreMatchesVerifiedShop(storeId, ctx.authenticatedShop);

    // A binding may preserve continuity metadata, but it can never select or
    // override the tenant. If present, it must agree with the live session.
    if (
      ctx.binding &&
      (ctx.binding.storeId !== storeId ||
        normalizeShopDomain(ctx.binding.shopDomain) !== ctx.authenticatedShop)
    ) {
      throw new TenantIsolationError(
        "Tenant binding does not match authenticated Shopify session",
      );
    }

    return { storeId, shopDomain: ctx.authenticatedShop, source: "session" };
  }

  // B1-A: cookies and service headers are never merchant authentication.
  // A current, verified Shopify session is mandatory for tenant resolution.
  return null;
}
