import type { AnalyzerOutput } from "@/lib/types";
import type { CommerceOpportunity } from "@/lib/insights/opportunity-schema";
import { createCommerceOpportunity } from "@/lib/insights/opportunity-schema";
import type { Opportunity } from "@/lib/types";
import type { LiveAiRecommendation, LiveInsightItem } from "./insights";
import type { ShopMetrics } from "./shop-metrics";

function severityToCommerce(
  severity: LiveInsightItem["severity"],
): CommerceOpportunity["severity"] {
  if (severity === "critical") return "critical";
  if (severity === "warning") return "high";
  return "medium";
}

function parseImpactMonthly(label: string): number {
  const m = label.match(/\$([\d,]+)/);
  if (!m) return 0;
  return Number(m[1].replace(/,/g, "")) || 0;
}

export function liveInsightsToCommerceOpportunities(
  metrics: ShopMetrics,
  items: LiveInsightItem[],
): CommerceOpportunity[] {
  return items.map((item) => {
    const profitMonthly =
      item.id === "hero-merchandising" && metrics.topProducts[0]
        ? Math.round(metrics.topProducts[0].revenue * 0.12)
        : item.id === "winback-segment"
          ? Math.round(metrics.revenue30d * 0.08)
          : item.id === "inventory-optimization"
            ? Math.round(metrics.revenue30d * 0.05)
            : item.id.startsWith("low-stock")
              ? Math.round(metrics.averageOrderValue30d * 4)
              : 0;

    return createCommerceOpportunity({
      id: `live-${item.id}`,
      source: "shopify",
      severity: severityToCommerce(item.severity),
      confidence: item.severity === "critical" ? 90 : item.severity === "warning" ? 82 : 75,
      title: item.title,
      description: item.description,
      recommendation: item.description,
      category:
        item.id.startsWith("low-stock") || item.id === "inventory-optimization"
          ? "inventory"
          : item.id === "winback-segment"
            ? "retention"
            : "trend",
      supportingMetrics: [
        { label: "Orders (30d)", value: String(metrics.orders30d) },
        { label: "Revenue (30d)", value: `$${Math.round(metrics.revenue30d).toLocaleString()}` },
      ],
      expectedImpact: {
        profitMonthly,
        revenueMonthly: profitMonthly > 0 ? Math.round(profitMonthly / 0.35) : 0,
        label: profitMonthly > 0 ? `Est. +$${profitMonthly.toLocaleString()}/mo` : "",
      },
      relatedEntityType: item.id.startsWith("low-stock") ? "product" : undefined,
      relatedEntityId: metrics.lowStockProducts.find((p) =>
        item.title.includes(p.title),
      )?.productGid,
    });
  });
}

export function liveAiRecommendationToAnalyzerOutput(
  rec: LiveAiRecommendation,
): AnalyzerOutput {
  const profitMonthly = parseImpactMonthly(rec.expectedImpactMonthly);

  return {
    id: `live-ai-${rec.title.slice(0, 24).replace(/\W+/g, "-").toLowerCase()}`,
    title: rec.title,
    description: rec.summary,
    priority: rec.confidencePct >= 85 ? "high" : "medium",
    expectedImpact: rec.expectedImpactMonthly,
    confidence: rec.confidencePct / 100,
    evidence: [
      { label: "Reason", value: rec.reason },
      { label: "Source", value: rec.sourceNote },
    ],
    actions: [{ label: "Review recommendation", type: "review" }],
    category: "promotion_opportunity",
    financialImpact: {
      estimatedMonthlyProfitIncrease: profitMonthly > 0 ? profitMonthly : null,
      estimatedMonthlyRevenueIncrease: profitMonthly > 0 ? Math.round(profitMonthly / 0.35) : null,
    },
  };
}

export function liveInsightsToOpportunities(
  metrics: ShopMetrics,
  items: LiveInsightItem[],
): Opportunity[] {
  return liveInsightsToCommerceOpportunities(metrics, items).map((opp) => ({
    id: opp.id,
    category: "product_growth",
    title: opp.title,
    description: opp.description,
    estimatedMonthlyRevenueImpact: opp.expectedImpact.revenueMonthly,
    estimatedMonthlyNetProfitImpact: opp.expectedImpact.profitMonthly,
    confidenceScore: opp.confidence / 100,
    evidence: opp.supportingMetrics,
    requiredActions: [opp.recommendation],
    implementationEffort: "Low",
  }));
}
