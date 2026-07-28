import { buildProductAttributionDashboard } from "@/lib/attribution/product-engine";
import { buildInventoryPageView } from "@/lib/inventory/engine";
import type { InventoryPageView } from "@/lib/inventory/types";
import { buildProductIntelligence } from "@/lib/products/engine";
import { getCachedStoreBundle } from "@/lib/services/store-bundle";
import { resyncShopifyCommerce } from "@/lib/shopify/resync-commerce.server";
import { hasLiveShopifyConnection, resolveActiveStoreId } from "@/lib/store/context";

export async function buildInventoryPageData(): Promise<{
  view: InventoryPageView;
  syncedAt: string;
} | null> {
  // Inventory edits in Shopify Admin must show up here without waiting for webhooks.
  // Force a commerce pull on Inventory page loads so stock changes are never stuck
  // behind a "fresh" but outdated shopify_sync_cache.
  const storeId = await resolveActiveStoreId();
  if (await hasLiveShopifyConnection(storeId)) {
    await resyncShopifyCommerce({
      storeId,
      source: "inventory-page",
      force: true,
    });
  }

  const bundle = await getCachedStoreBundle();
  const productAttribution = buildProductAttributionDashboard(
    bundle.snapshot,
    bundle.costRecords,
    bundle.profitDashboard,
  );
  const intelligence = buildProductIntelligence(
    bundle.snapshot,
    bundle.costRecords,
    bundle.profitDashboard,
    productAttribution,
  );

  const view = buildInventoryPageView({
    snapshot: bundle.snapshot,
    intelligence,
    attribution: productAttribution,
  });
  if (!view) return null;

  return { view, syncedAt: bundle.snapshot.syncedAt };
}
