import type { RecommendationAnalyzer } from "./analyzer-types";
import type { AnalyzerOutput } from "@/lib/types";

export const inventoryAnalyzer: RecommendationAnalyzer = {
  id: "inventory",
  category: "low_inventory",
  analyze(snapshot) {
    const results: AnalyzerOutput[] = [];

    for (const product of snapshot.products) {
      const dailyVelocity = product.unitsSold30d / 30;
      const daysOfCover =
        dailyVelocity > 0 ? product.inventoryQuantity / dailyVelocity : 999;

      if (product.inventoryQuantity <= 15 && dailyVelocity >= 2) {
        results.push({
          id: `inv-${product.id}`,
          category: "low_inventory",
          title: `Low Inventory Alert — ${product.title}`,
          description: `${product.title} has only ${product.inventoryQuantity} units left while selling ~${dailyVelocity.toFixed(1)} units/day. Stock may run out before replenishment.`,
          priority: daysOfCover <= 5 ? "critical" : "high",
          expectedImpact: `Prevent an estimated $${Math.round(dailyVelocity * product.price * 7)} in lost revenue over the next 7 days.`,
          confidence: daysOfCover <= 5 ? 0.92 : 0.84,
          evidence: [
            { label: "Units on hand", value: String(product.inventoryQuantity) },
            { label: "30-day units sold", value: String(product.unitsSold30d) },
            { label: "Days of cover", value: daysOfCover.toFixed(1) },
            { label: "30-day revenue", value: `$${product.revenue30d.toLocaleString()}` },
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
