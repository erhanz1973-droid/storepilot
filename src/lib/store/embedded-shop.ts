/** Cookie set by middleware on embedded Shopify Admin requests (survives in-iframe navigation). */
export const EMBEDDED_SHOP_COOKIE = "storepilot_embedded_shop";

const SHOP_DOMAIN = /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/;

/** Normalize a Shopify shop domain from query params or host slug. */
export function normalizeShopDomain(shop: string | null | undefined): string | null {
  if (!shop) return null;
  const trimmed = shop.trim().toLowerCase();
  if (!trimmed) return null;
  const domain = trimmed.includes(".") ? trimmed : `${trimmed}.myshopify.com`;
  return SHOP_DOMAIN.test(domain) ? domain : null;
}

/**
 * Derive shop domain from Shopify's base64 `host` param when `shop` is absent.
 * Example host decodes to: admin.shopify.com/store/storepilot-ai-demo
 */
export function shopDomainFromHostParam(host: string | null | undefined): string | null {
  if (!host?.trim()) return null;
  try {
    const normalized = host.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    const decoded = Buffer.from(padded, "base64").toString("utf8");
    const match = decoded.match(/\/store\/([a-zA-Z0-9-]+)/);
    if (!match?.[1]) return null;
    return normalizeShopDomain(match[1]);
  } catch {
    return null;
  }
}

export function resolveShopFromEmbeddedRequest(input: {
  shopParam?: string | null;
  hostParam?: string | null;
}): string | null {
  return normalizeShopDomain(input.shopParam) ?? shopDomainFromHostParam(input.hostParam);
}

export function isEmbeddedShopifyRequest(input: {
  embeddedParam?: string | null;
  hostParam?: string | null;
  shopParam?: string | null;
}): boolean {
  return (
    input.embeddedParam === "1" ||
    Boolean(input.hostParam) ||
    Boolean(normalizeShopDomain(input.shopParam))
  );
}
