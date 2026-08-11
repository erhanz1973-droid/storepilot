/**
 * Start Shopify OAuth on the app origin so the state cookie matches the callback host.
 * Marketing (storepilotai.pro) and the embedded app URL may differ.
 */
export function resolveShopifyAuthStartUrl(
  shopDomain: string,
  currentOrigin?: string | null,
): string {
  const path = `/api/shopify/auth?shop=${encodeURIComponent(shopDomain)}`;
  const configured =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    process.env.SHOPIFY_APP_URL?.replace(/\/$/, "") ||
    "";

  if (!configured) return path;

  try {
    const appOrigin = new URL(configured).origin;
    if (currentOrigin) {
      const here = new URL(currentOrigin).origin;
      if (here === appOrigin) return path;
    }
    return `${appOrigin}${path}`;
  } catch {
    return path;
  }
}

export function normalizeMarketingShopDomain(input: string): string {
  let domain = input.trim().toLowerCase();
  domain = domain.replace(/^https?:\/\//, "");
  domain = domain.split("/")[0] ?? domain;
  domain = domain.replace(/:\d+$/, "");
  if (!domain) return "";
  if (!domain.includes(".")) {
    domain = `${domain}.myshopify.com`;
  }
  return domain;
}
