import { buildProductAttributionDashboard } from "@/lib/attribution/product-engine";
import { assembleProfitPageView } from "@/lib/profit/profit-page-view";
import type { ProductAttributionDashboard } from "@/lib/attribution/product-types";
import type { ProfitDashboard } from "@/lib/profit/types";
import type { ProfitPageView } from "@/lib/profit/profit-page-view";
import { getCachedProfitDashboard, getCachedStoreBundle } from "@/lib/services/store-bundle";

export async function buildProfitDashboard(): Promise<ProfitDashboard | null> {
  const bundle = await getCachedStoreBundle();
  return bundle.profitDashboard;
}

export async function buildProductAttribution(): Promise<ProductAttributionDashboard | null> {
  const bundle = await getCachedStoreBundle();
  return buildProductAttributionDashboard(
    bundle.snapshot,
    bundle.costRecords,
    bundle.profitDashboard,
  );
}

export async function buildProfitPageData(): Promise<{
  dashboard: ProfitDashboard;
  view: ProfitPageView;
  productAttribution: ProductAttributionDashboard | null;
} | null> {
  const bundle = await getCachedStoreBundle();
  const dashboard = bundle.profitDashboard;
  if (!dashboard) return null;
  const productAttribution = buildProductAttributionDashboard(
    bundle.snapshot,
    bundle.costRecords,
    dashboard,
  );
  return {
    dashboard,
    productAttribution,
    view: assembleProfitPageView(dashboard, bundle.snapshot, productAttribution),
  };
}

/** Cached alias used by reports and other aggregators. */
export { getCachedProfitDashboard };
