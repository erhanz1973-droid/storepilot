import { getInstallationForStore } from "@/lib/db/shopify";
import { getShopifyConfig } from "@/lib/shopify/oauth";

/**
 * Return to the app through Shopify Admin so App Bridge can restore the
 * embedded context and attach session tokens to protected API requests.
 */
export async function buildEmbeddedAdminReturnUrl(
  storeId: string,
  path: string,
): Promise<string | null> {
  const config = getShopifyConfig();
  const installation = await getInstallationForStore(storeId);
  if (!installation || !config) return null;

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `https://${installation.shop_domain}/admin/apps/${encodeURIComponent(config.apiKey)}${normalizedPath}`;
}
