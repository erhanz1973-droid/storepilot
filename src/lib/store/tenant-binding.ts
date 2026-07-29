import { createHmac, timingSafeEqual } from "crypto";
import { normalizeShopDomain } from "@/lib/store/embedded-shop";

/** HttpOnly cookie binding store_id ↔ verified shop after authenticate.admin / OAuth. */
export const TENANT_BINDING_COOKIE = "storepilot_tenant_binding";

export const TENANT_BINDING_COOKIE_OPTIONS = {
  path: "/",
  httpOnly: true,
  secure: true,
  sameSite: "none" as const,
  maxAge: 60 * 60 * 24 * 90,
};

export type TenantBinding = {
  storeId: string;
  shopDomain: string;
};

function bindingSecret(): string | null {
  const secret =
    process.env.TOKEN_ENCRYPTION_KEY?.trim() ||
    process.env.SHOPIFY_API_SECRET?.trim() ||
    null;
  return secret && secret.length >= 16 ? secret : null;
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

/**
 * Build a signed tenant binding value. Only call after a verified Shopify session
 * established the shop ↔ store_id pairing.
 */
export function createTenantBindingValue(storeId: string, shopDomain: string): string | null {
  const secret = bindingSecret();
  const shop = normalizeShopDomain(shopDomain);
  if (!secret || !shop || !storeId.trim()) return null;
  const body = `${storeId.trim()}:${shop}`;
  return `${Buffer.from(body, "utf8").toString("base64url")}.${sign(body, secret)}`;
}

/** Verify a tenant binding cookie. Returns null if missing, forged, or malformed. */
export function parseTenantBindingCookie(raw: string | null | undefined): TenantBinding | null {
  if (!raw?.trim()) return null;
  const secret = bindingSecret();
  if (!secret) return null;

  const [encoded, signature] = raw.trim().split(".");
  if (!encoded || !signature) return null;

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

  const sep = body.indexOf(":");
  if (sep <= 0) return null;
  const storeId = body.slice(0, sep).trim();
  const shopDomain = normalizeShopDomain(body.slice(sep + 1));
  if (!storeId || !shopDomain) return null;
  return { storeId, shopDomain };
}

export function tenantBindingCookie(storeId: string, shopDomain: string): {
  name: string;
  value: string;
  options: typeof TENANT_BINDING_COOKIE_OPTIONS;
} | null {
  const value = createTenantBindingValue(storeId, shopDomain);
  if (!value) return null;
  return {
    name: TENANT_BINDING_COOKIE,
    value,
    options: TENANT_BINDING_COOKIE_OPTIONS,
  };
}
