import { buildProductAttributionDashboard } from "@/lib/attribution/product-engine";
import { buildProductIntelligence } from "@/lib/products/engine";
import { assembleProductsPageView } from "@/lib/products/page-view";
import type { ProductIntelligenceDashboard } from "@/lib/products/types";
import type { ProductsPageView } from "@/lib/products/page-view";
import type { ProductAttributionDashboard } from "@/lib/attribution/product-types";
import { getCachedStoreBundle } from "@/lib/services/store-bundle";

export async function buildProductIntelligenceDashboard(): Promise<ProductIntelligenceDashboard | null> {
  const bundle = await getCachedStoreBundle();
  const productAttribution = buildProductAttributionDashboard(
    bundle.snapshot,
    bundle.costRecords,
    bundle.profitDashboard,
  );
  return buildProductIntelligence(
    bundle.snapshot,
    bundle.costRecords,
    bundle.profitDashboard,
    productAttribution,
  );
}

export async function buildProductsPageData(): Promise<{
  intelligence: ProductIntelligenceDashboard;
  attribution: ProductAttributionDashboard | null;
  view: ProductsPageView;
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
  if (!intelligence) return null;
  return {
    intelligence,
    attribution: productAttribution,
    view: assembleProductsPageView(intelligence, productAttribution, bundle.snapshot),
  };
}
