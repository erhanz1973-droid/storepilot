import type { RecommendationAnalyzer } from "./analyzer-types";
import type { AnalyzerOutput } from "@/lib/types";
import { isDeadInventoryProduct } from "@/lib/insights/business-action-groups";

export const pricingAnalyzer: RecommendationAnalyzer = {
  id: "pricing",
  category: "slow_selling",
  analyze(snapshot) {
    const results: AnalyzerOutput[] = [];

    for (const product of snapshot.products) {
      if (isDeadInventoryProduct(product)) continue;

      if (product.unitsSold30d <= 20 && product.inventoryQuantity >= 30) {
        results.push({
          id: `slow-${product.id}`,
          category: "slow_selling",
          title: `Slow Seller Review — ${product.title}`,
          description: `${product.title} sold only ${product.unitsSold30d} units in 30 days while holding ${product.inventoryQuantity} units. This ties up cash and shelf space.`,
          priority: product.revenue30d < 1200 ? "medium" : "low",
          expectedImpact:
            "Free up working capital and improve inventory turnover by reviewing merchandising or promotion for this SKU.",
          confidence: 0.78,
          evidence: [
            { label: "30-day units sold", value: String(product.unitsSold30d) },
            { label: "Inventory on hand", value: String(product.inventoryQuantity) },
            { label: "30-day revenue", value: `$${product.revenue30d.toLocaleString()}` },
            {
              label: "Sell-through rate",
              value: `${((product.unitsSold30d / Math.max(product.inventoryQuantity, 1)) * 100).toFixed(0)}%`,
              trend: "down",
            },
          ],
          actions: [{ label: "Review", type: "review" }],
          entityType: "product",
          entityId: product.id,
        });
      }

      if (product.unitsSold30d <= 20 && product.price >= 80) {
        results.push({
          id: `price-${product.id}`,
          category: "slow_selling",
          title: `Price Increase Opportunity — ${product.title}`,
          description: `${product.title} has low velocity (${product.unitsSold30d} units / 30d) at $${product.price}. Demand may be price-sensitive; testing a modest price change with monitoring is worth reviewing.`,
          priority: "low",
          expectedImpact: `If elasticity is low, a 5% price increase could add ~$${Math.round(product.revenue30d * 0.05)} monthly with minimal volume impact.`,
          confidence: 0.62,
          evidence: [
            { label: "Current price", value: `$${product.price}` },
            { label: "30-day units sold", value: String(product.unitsSold30d) },
            { label: "30-day revenue", value: `$${product.revenue30d.toLocaleString()}` },
            { label: "Inventory on hand", value: String(product.inventoryQuantity) },
          ],
          actions: [{ label: "Review", type: "review" }],
          entityType: "product",
          entityId: product.id,
        });
      }
    }

    return results;
  },
};
