import { buildProductAttributionDashboard } from "@/lib/attribution/product-engine";
import { buildInventoryPageView } from "@/lib/inventory/engine";
import type { InventoryPageView } from "@/lib/inventory/types";
import { buildProductIntelligence } from "@/lib/products/engine";
import { getCachedStoreBundle } from "@/lib/services/store-bundle";

export async function buildInventoryPageData(): Promise<{
  view: InventoryPageView;
  syncedAt: string;
} | null> {
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
