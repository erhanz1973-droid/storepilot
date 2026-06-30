import type { ProductIntelligenceDashboard } from "@/lib/products/types";
import type { StoreSnapshot } from "@/lib/connectors/types";
import type { PricingRecommendation } from "./types";

export function buildPricingRecommendations(
  snapshot: StoreSnapshot,
  productIntelligence: ProductIntelligenceDashboard | null,
): PricingRecommendation[] {
  if (!productIntelligence) return [];

  const results: PricingRecommendation[] = [];

  for (const p of productIntelligence.products) {
    const shopify = snapshot.products.find((sp) => sp.id === p.productId);
    if (!shopify) continue;

    if (p.isLosingMoney && p.marginPct < 15) {
      results.push({
        productId: p.productId,
        title: p.title,
        action: "increase_price",
        currentPrice: shopify.price,
        suggestedChange: `Raise price 8–12% (currently losing $${Math.abs(p.netProfit).toLocaleString()} net)`,
        expectedRevenueChange: Math.round(p.revenue * -0.05),
        expectedProfitChange: Math.round(Math.abs(p.netProfit) * 0.4),
        expectedConversionChangePct: -3,
        confidenceScore: 0.7,
      });
    } else if (p.marginPct >= 45 && p.trends.revenueGrowthPct != null && p.trends.revenueGrowthPct > 15) {
      results.push({
        productId: p.productId,
        title: p.title,
        action: "increase_price",
        currentPrice: shopify.price,
        suggestedChange: `Test +5% price — strong ${p.marginPct}% margin and ${p.trends.revenueGrowthPct}% growth`,
        expectedRevenueChange: Math.round(p.revenue * 0.04),
        expectedProfitChange: Math.round(p.netProfit * 0.08),
        expectedConversionChangePct: -1.5,
        confidenceScore: 0.68,
      });
    } else if (p.inventoryRisk === "overstock" || (p.inventory > 80 && p.unitsSold < 20)) {
      results.push({
        productId: p.productId,
        title: p.title,
        action: "start_promotion",
        currentPrice: shopify.price,
        suggestedChange: "10% limited promotion to clear slow inventory",
        expectedRevenueChange: Math.round(p.revenue * 0.2),
        expectedProfitChange: Math.round(p.netProfit * 0.05),
        expectedConversionChangePct: 12,
        confidenceScore: 0.65,
      });
    } else if (shopify.compareAtPrice && shopify.compareAtPrice > shopify.price) {
      results.push({
        productId: p.productId,
        title: p.title,
        action: "remove_discount",
        currentPrice: shopify.price,
        suggestedChange: "Remove compare-at discount — margin may be eroded",
        expectedRevenueChange: Math.round(p.revenue * -0.02),
        expectedProfitChange: Math.round(p.netProfit * 0.06),
        expectedConversionChangePct: -2,
        confidenceScore: 0.62,
      });
    }

    if (shopify.tags?.includes("bundle-candidate") && p.marginPct > 30) {
      results.push({
        productId: p.productId,
        title: p.title,
        action: "bundle",
        currentPrice: shopify.price,
        suggestedChange: "Bundle with complementary SKU to increase AOV",
        expectedRevenueChange: Math.round(p.revenue * 0.1),
        expectedProfitChange: Math.round(p.netProfit * 0.12),
        expectedConversionChangePct: 5,
        confidenceScore: 0.64,
      });
    }
  }

  return results
    .sort((a, b) => b.expectedProfitChange - a.expectedProfitChange)
    .slice(0, 8);
}
