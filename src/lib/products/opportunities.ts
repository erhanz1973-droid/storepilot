import { revenueToNetProfitImpact } from "@/lib/opportunities/profit-impact";
import type { StoreSnapshot } from "@/lib/connectors/types";
import type { Opportunity } from "@/lib/types";
import type { ProductIntelligenceProfile } from "./types";

function opp(
  partial: Omit<Opportunity, "estimatedMonthlyNetProfitImpact"> & {
    estimatedMonthlyRevenueImpact: number;
  },
  netMarginPct?: number,
): Opportunity {
  const estimatedMonthlyNetProfitImpact = revenueToNetProfitImpact(
    partial.estimatedMonthlyRevenueImpact,
    "product_growth",
    netMarginPct,
  );
  return { ...partial, estimatedMonthlyNetProfitImpact };
}

export function evaluateProductGrowthOpportunities(
  products: ProductIntelligenceProfile[],
  snapshot: StoreSnapshot,
  netMarginPct?: number,
): Opportunity[] {
  const results: Opportunity[] = [];

  for (const p of products) {
    if (p.isHiddenWinner && p.productRoas != null && p.productRoas >= 2) {
      results.push(
        opp({
          id: `pg-ad-${p.productId}`,
          category: "product_growth",
          title: `Increase advertising — ${p.title}`,
          description: `${p.title} has ${p.marginPct}% margin and low ad allocation. Scaling Meta budget could lift net profit.`,
          estimatedMonthlyRevenueImpact: Math.round(p.revenue * 0.15),
          expectedRoas: p.productRoas,
          adEfficiencyAction: "increase_budget",
          confidenceScore: 0.76,
          evidence: [
            { label: "Net profit (30d)", value: `$${p.netProfit.toLocaleString()}` },
            { label: "Margin", value: `${p.marginPct}%` },
            { label: "Product ROAS", value: p.productRoas?.toFixed(2) ?? "—" },
            { label: "Ad cost (30d)", value: `$${p.adCost.toLocaleString()}` },
          ],
          requiredActions: [
            "Increase Meta budget 15–20% on campaigns featuring this SKU",
            "Monitor Blended ROAS for 7 days",
          ],
          implementationEffort: "Medium",
        }, netMarginPct),
      );
    }

    if (p.isLosingMoney && p.adCost > p.revenue * 0.15) {
      results.push(
        opp({
          id: `pg-reduce-ad-${p.productId}`,
          category: "product_growth",
          title: `Reduce advertising — ${p.title}`,
          description: `${p.title} is losing $${Math.abs(p.netProfit).toLocaleString()} net profit while consuming ad spend.`,
          estimatedMonthlyRevenueImpact: Math.round(p.adCost * 0.5),
          expectedRoas: 0,
          adEfficiencyAction: "reduce_budget",
          confidenceScore: 0.82,
          evidence: [
            { label: "Net profit", value: `$${p.netProfit.toLocaleString()}`, trend: "down" },
            { label: "Ad cost", value: `$${p.adCost.toLocaleString()}` },
            { label: "Refund rate", value: `${p.refundRatePct}%` },
          ],
          requiredActions: ["Pause or reduce ads featuring this SKU", "Review pricing and COGS"],
          implementationEffort: "Low",
        }, netMarginPct),
      );
    }

    if (p.inventoryRisk === "low_stock" && p.netProfit > 0) {
      results.push(
        opp({
          id: `pg-restock-${p.productId}`,
          category: "product_growth",
          title: `Restock inventory — ${p.title}`,
          description: `Based on the last 30 days, ${p.title} is expected to sell out in ~${p.daysUntilStockout} days.`,
          estimatedMonthlyRevenueImpact: Math.round((p.revenue / 30) * p.daysUntilStockout! * 4),
          expectedRoas: p.productRoas ?? undefined,
          confidenceScore: 0.88,
          evidence: [
            { label: "Days until stockout", value: String(p.daysUntilStockout) },
            { label: "Inventory", value: String(p.inventory) },
            { label: "Units sold (30d)", value: String(p.unitsSold) },
          ],
          requiredActions: ["Place replenishment order", "Enable low-stock alerts"],
          implementationEffort: "Low",
        }, netMarginPct),
      );
    }

    if (p.marginPct >= 35 && p.trends.revenueGrowthPct != null && p.trends.revenueGrowthPct > 10) {
      const notFeatured = snapshot.collections.every(
        (c) => !c.homepageFeatured || !snapshot.products.find((sp) => sp.id === p.productId)?.collectionIds.includes(c.id),
      );
      if (notFeatured) {
        results.push(
          opp({
            id: `pg-feature-${p.productId}`,
            category: "product_growth",
            title: `Feature on homepage — ${p.title}`,
            description: `${p.title} is growing ${p.trends.revenueGrowthPct}% with ${p.marginPct}% margin — prime for homepage placement.`,
            estimatedMonthlyRevenueImpact: Math.round(p.revenue * 0.12),
            expectedRoas: p.productRoas ?? undefined,
            confidenceScore: 0.7,
            evidence: [
              { label: "Revenue growth", value: `+${p.trends.revenueGrowthPct}%`, trend: "up" },
              { label: "Margin", value: `${p.marginPct}%` },
            ],
            requiredActions: ["Add to homepage hero or featured collection", "Track CTR for 7 days"],
            implementationEffort: "Low",
          }, netMarginPct),
        );
      }
    }

    if (snapshot.products.find((sp) => sp.id === p.productId)?.tags?.includes("bundle-candidate")) {
      const partner = products.find(
        (other) => other.productId !== p.productId && other.marginPct > 25 && other.netProfit > 0,
      );
      if (partner) {
        results.push(
          opp({
            id: `pg-bundle-${p.productId}`,
            category: "product_growth",
            title: `Create bundle — ${p.title} + ${partner.title}`,
            description: `Pair ${p.title} with ${partner.title} to increase AOV and protect margin.`,
            estimatedMonthlyRevenueImpact: Math.round((p.revenue + partner.revenue) * 0.08),
            expectedRoas: p.productRoas ?? undefined,
            confidenceScore: 0.65,
            evidence: [
              { label: "Combined margin", value: `${Math.round((p.marginPct + partner.marginPct) / 2)}%` },
            ],
            requiredActions: ["Create bundle SKU in Shopify", "Promote in email + Meta"],
            implementationEffort: "Medium",
          }, netMarginPct),
        );
      }
    }
  }

  return results
    .sort((a, b) => b.estimatedMonthlyNetProfitImpact - a.estimatedMonthlyNetProfitImpact)
    .slice(0, 8);
}
