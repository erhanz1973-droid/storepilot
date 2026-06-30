import type { StoreSnapshot } from "@/lib/connectors/types";
import { createCommerceOpportunity } from "./opportunity-schema";
import type { CommerceOpportunity } from "./opportunity-schema";

/**
 * Merchant Center feed insights — placeholder until GMC OAuth sync ships.
 * Uses Shopify catalog heuristics when GMC is not connected.
 */
export function buildMerchantCenterInsights(snapshot: StoreSnapshot): CommerceOpportunity[] {
  const results: CommerceOpportunity[] = [];
  const products = snapshot.products;

  const missingCost = products.filter((p) => p.unitCost == null && p.unitsSold30d >= 10);
  if (missingCost.length >= 3) {
    results.push(
      createCommerceOpportunity({
        id: "gmc-missing-cost-data",
        source: "merchant_center",
        severity: "medium",
        confidence: 60,
        title: "Product feed missing cost data for Shopping",
        description: `${missingCost.length} active SKUs lack unit cost — ROAS and margin reporting in Shopping will be incomplete.`,
        recommendation: "Sync COGS to Shopify inventory items before scaling Shopping campaigns.",
        category: "product_ads",
        supportingMetrics: [
          { label: "SKUs missing cost", value: String(missingCost.length) },
          { label: "Active SKUs (30d)", value: String(products.filter((p) => p.unitsSold30d > 0).length) },
        ],
        expectedImpact: { profitMonthly: Math.round(snapshot.storeMetrics.revenue30d * 0.02), label: "" },
      }),
    );
  }

  const lowPriceHighVolume = products.find(
    (p) => p.price < 25 && p.unitsSold30d >= 40 && !p.compareAtPrice,
  );
  if (lowPriceHighVolume) {
    results.push(
      createCommerceOpportunity({
        id: `gmc-price-competitiveness-${lowPriceHighVolume.id}`,
        source: "merchant_center",
        severity: "low",
        confidence: 58,
        title: `Shopping price competitiveness — ${lowPriceHighVolume.title}`,
        description: "High-volume SKU has no compare-at price — limited sale badge visibility in Shopping.",
        recommendation: "Add compare-at pricing or Merchant Center promotions for this hero SKU.",
        category: "pricing",
        supportingMetrics: [
          { label: "Price", value: `$${lowPriceHighVolume.price}` },
          { label: "Units (30d)", value: String(lowPriceHighVolume.unitsSold30d) },
        ],
        expectedImpact: { revenueMonthly: Math.round(lowPriceHighVolume.revenue30d * 0.08), label: "" },
        relatedEntityType: "product",
        relatedEntityId: lowPriceHighVolume.id,
      }),
    );
  }

  return results;
}
