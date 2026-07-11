import type { Session } from "@shopify/shopify-api";
import {
  findStoreByShopDomain,
  updateShopifySyncResult,
} from "@/lib/db/shopify";
import { registerAppWebhooks } from "@/lib/shopify/oauth";
import { syncShopifyStore } from "@/lib/shopify/sync";

/** Post-embedded-auth hook — reuses the existing syncShopifyStore() pipeline only. */
export async function runAfterEmbeddedAuth(session: Session): Promise<void> {
  if (!session.accessToken) {
    console.log("[embedded-auth] afterAuth skipped — no access token on session", {
      shop: session.shop,
      sessionId: session.id,
    });
    return;
  }

  console.log("[embedded-auth] afterAuth starting sync", {
    shop: session.shop,
    sessionId: session.id,
    isOnline: session.isOnline,
  });

  try {
    await registerAppWebhooks(session.shop, session.accessToken);
  } catch (error) {
    console.error("[embedded-auth] webhook registration failed (non-fatal)", error);
  }

  try {
    const syncResult = await syncShopifyStore(session.shop, session.accessToken);
    const storeId = await findStoreByShopDomain(session.shop);
    if (storeId) {
      await updateShopifySyncResult(storeId, syncResult.stats, syncResult.snapshot, {
        shopName: syncResult.shopName,
        shopifyPlan: syncResult.shopifyPlan,
      });
    }
    console.log("[embedded-auth] afterAuth sync complete", {
      shop: session.shop,
      storeId,
      orders: syncResult.stats.orderCount,
    });
  } catch (error) {
    console.error("[embedded-auth] afterAuth sync failed (installation still saved)", error);
  }
}
