import type { Session } from "@shopify/shopify-api";
import { updateShopifySyncResult } from "@/lib/db/shopify";
import { isShopifyReinstallRequiredError } from "@/lib/shopify/auth-errors";
import { persistInstallationFromSession } from "@/lib/shopify/persist-installation.server";
import { registerAppWebhooks } from "@/lib/shopify/oauth";
import { syncShopifyStore } from "@/lib/shopify/sync";

/** Post-embedded-auth hook — persists installation then reuses syncShopifyStore(). */
export async function runAfterEmbeddedAuth(session: Session): Promise<void> {
  if (!session.accessToken) {
    console.log("[embedded-auth] afterAuth skipped — no access token on session", {
      shop: session.shop,
      sessionId: session.id,
    });
    return;
  }

  console.log("[embedded-auth] afterAuth starting", {
    shop: session.shop,
    sessionId: session.id,
    isOnline: session.isOnline,
  });

  let persisted: Awaited<ReturnType<typeof persistInstallationFromSession>> = null;
  try {
    persisted = await persistInstallationFromSession(session, "afterAuth");
  } catch (error) {
    console.error("[embedded-auth] afterAuth persist failed", {
      shop: session.shop,
      message: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }

  try {
    await registerAppWebhooks(session.shop, session.accessToken);
  } catch (error) {
    console.error("[embedded-auth] webhook registration failed (non-fatal)", error);
  }

  try {
    const syncResult = await syncShopifyStore(session.shop, session.accessToken, {
      storedClientId: persisted?.clientId,
    });
    if (persisted?.storeId) {
      await updateShopifySyncResult(persisted.storeId, syncResult.stats, syncResult.snapshot, {
        shopName: syncResult.shopName,
        shopifyPlan: syncResult.shopifyPlan,
      });
    }
    console.log("[embedded-auth] afterAuth sync complete", {
      shop: session.shop,
      storeId: persisted?.storeId,
      orders: syncResult.stats.orderCount,
    });
  } catch (error) {
    if (isShopifyReinstallRequiredError(error)) {
      console.error("[embedded-auth] afterAuth sync reinstall required (installation already persisted)", {
        shop: session.shop,
        reason: error.reason,
      });
      return;
    }
    console.error("[embedded-auth] afterAuth sync failed (installation persisted)", {
      shop: session.shop,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
