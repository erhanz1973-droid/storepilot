import type { Session } from "@shopify/shopify-api";
import {
  createStoreForShop,
  findStoreByShopDomain,
  upsertShopifyInstallation,
} from "@/lib/db/shopify";
import { shopifyApiKeyPrefix } from "@/lib/shopify/token-diagnostics";

export type PersistInstallationResult = {
  storeId: string;
  shopDomain: string;
  clientId: string | null;
  clientIdPrefix: string | null;
};

/**
 * Single write path for shopify_installations after Shopify auth.
 * Called from session storage (offline token) and afterAuth (safety net).
 */
export async function persistInstallationFromSession(
  session: Session,
  source: string,
): Promise<PersistInstallationResult | null> {
  console.log(
    "[shopify-persist]",
    JSON.stringify({
      phase: "start",
      source,
      shop: session.shop,
      sessionId: session.id,
      isOnline: session.isOnline,
      hasAccessToken: Boolean(session.accessToken),
    }),
  );

  if (!session.accessToken) {
    console.log("[shopify-persist] skipped — session has no access token", { source, shop: session.shop });
    return null;
  }

  const shop = session.shop;
  let storeId = await findStoreByShopDomain(shop);
  if (!storeId) {
    console.log("[shopify-persist] creating store row", { shop, source });
    storeId = await createStoreForShop(shop, shop);
  }

  const scopes =
    session.scope
      ?.split(",")
      .map((scope) => scope.trim())
      .filter(Boolean) ?? [];

  console.log("[shopify-persist] before upsertShopifyInstallation", {
    source,
    shop,
    storeId,
    scopeCount: scopes.length,
  });

  const installation = await upsertShopifyInstallation({
    storeId,
    shopDomain: shop,
    accessToken: session.accessToken,
    scopes,
    refreshToken: session.refreshToken ?? undefined,
    refreshTokenExpires: session.refreshTokenExpires ?? undefined,
  });

  const result: PersistInstallationResult = {
    storeId: installation.store_id,
    shopDomain: installation.shop_domain,
    clientId: installation.clientId,
    clientIdPrefix: shopifyApiKeyPrefix(installation.clientId),
  };

  console.log(
    "[shopify-persist]",
    JSON.stringify({
      phase: "complete",
      source,
      shop: result.shopDomain,
      storeId: result.storeId,
      clientIdPrefix: result.clientIdPrefix,
      status: installation.status,
      connectionHealth: installation.connection_health,
    }),
  );

  return result;
}
