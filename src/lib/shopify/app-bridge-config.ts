/**
 * App Bridge 4 CDN bootstrap for the Next.js root layout.
 * API key (Partner client ID) is public by design — safe to expose to the browser.
 * @see https://shopify.dev/docs/api/app-bridge/migration-guide
 */
export function resolveShopifyAppBridgeApiKey(): string | null {
  const key =
    process.env.NEXT_PUBLIC_SHOPIFY_API_KEY?.trim() ||
    process.env.SHOPIFY_API_KEY?.trim() ||
    null;
  return key || null;
}
