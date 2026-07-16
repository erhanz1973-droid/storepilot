/**
 * Top-level navigation helpers for Shopify embedded apps (App Bridge 4).
 * @see https://shopify.dev/docs/api/app-bridge-library/apis/navigation
 */

/** Leave the Admin iframe (OAuth, billing, external hosts). */
export function redirectTop(url: string): void {
  if (typeof window === "undefined") return;
  window.open(url, "_top");
}

/** True when running inside Shopify Admin iframe / embedded query context. */
export function isShopifyEmbeddedContext(): boolean {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  if (params.get("shop") || params.get("host") || params.get("embedded") === "1") {
    return true;
  }
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}
