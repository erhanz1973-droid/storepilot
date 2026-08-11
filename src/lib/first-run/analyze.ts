import { ensureRecommendationsSynced } from "@/lib/services/dashboard";
import { getCachedStoreBundle } from "@/lib/services/store-bundle";
import { hasLiveShopifyConnection, resolveActiveStoreId } from "@/lib/store/context";
import { resyncShopifyCommerce } from "@/lib/shopify/resync-commerce.server";
import {
  assembleFirstRunAnalyzeResult,
  extraAnalyzerOutputsForFirstValue,
} from "@/lib/first-run/assemble";
import type { FirstRunAnalyzeResult } from "@/lib/first-run/types";

export async function runFirstRunAnalysis(): Promise<FirstRunAnalyzeResult> {
  const started = Date.now();
  const storeId = await resolveActiveStoreId();
  const shopifyConnected = await hasLiveShopifyConnection(storeId);

  // Retry Analysis / first-run must re-pull Shopify commerce. Otherwise a cache
  // written before a brand-new test order keeps showing "0 orders".
  if (shopifyConnected) {
    const sync = await resyncShopifyCommerce({
      storeId,
      source: "first-run-analyze",
      force: true,
    });
    console.log(
      "[first-run]",
      JSON.stringify({
        event: "commerce_resync",
        storeId,
        synced: sync.synced,
        skipped: sync.skipped,
        reason: sync.reason,
        products: "products" in sync ? sync.products : undefined,
        orders30d: "orders30d" in sync ? sync.orders30d : undefined,
      }),
    );
  }

  const bundle = await getCachedStoreBundle();
  const snapshot = bundle.snapshot;

  const productsAnalyzed = snapshot.products.length;
  const ordersAnalyzed =
    snapshot.commerceOrders?.length ?? snapshot.storeMetrics.orders30d ?? 0;
  console.log(
    "[first-run]",
    JSON.stringify({
      event: "dashboard_order_count",
      storeId,
      productsAnalyzed,
      ordersAnalyzed,
      commerceOrdersLength: snapshot.commerceOrders?.length ?? null,
      storeMetricsOrders30d: snapshot.storeMetrics?.orders30d ?? null,
      syncedAt: snapshot.syncedAt ?? null,
    }),
  );

  const extra = shopifyConnected ? extraAnalyzerOutputsForFirstValue(snapshot) : [];
  const recommendations = shopifyConnected
    ? await ensureRecommendationsSynced(storeId, snapshot, extra)
    : [];

  return assembleFirstRunAnalyzeResult({
    storeId,
    shopifyConnected,
    snapshot,
    recommendations,
    hasProfit: bundle.profitDashboard != null,
    durationMs: Date.now() - started,
  });
}
