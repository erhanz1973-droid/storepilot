import type { CommerceOpportunity } from "@/lib/insights/opportunity-schema";
import type { CopilotIntent } from "./types";

const INTENT_KEYWORDS: Partial<Record<CopilotIntent, string[]>> = {
  roas_decrease: ["roas", "cpa", "spend", "conversion", "cpm", "ctr"],
  pause_campaigns: ["pause", "zero conversion", "wast", "losing", "below target"],
  product_ads_budget: ["product", "traffic", "margin", "grow", "scale"],
  product_profit_hurt: ["losing", "margin", "profit", "refund"],
  restock: ["inventory", "stock", "stockout", "restock", "low inventory"],
  biggest_risk: ["critical", "risk", "stockout", "zero conversion"],
  sales_yesterday: ["revenue", "conversion", "sales", "orders"],
  best_channel: ["channel", "google", "meta", "roas", "acquisition"],
};

export function findMatchingInsights(
  intent: CopilotIntent,
  opportunities: CommerceOpportunity[],
  limit = 5,
): CommerceOpportunity[] {
  const keywords = INTENT_KEYWORDS[intent] ?? [];

  const scored = opportunities.map((opp) => {
    let score = opp.priorityScore;
    const text = `${opp.title} ${opp.description} ${opp.category}`.toLowerCase();
    for (const kw of keywords) {
      if (text.includes(kw)) score += 50;
    }
    if (intent === "biggest_opportunities" || intent === "today") {
      score += opp.expectedImpact.profitMonthly + opp.expectedImpact.revenueMonthly * 0.3;
    }
    if (intent === "biggest_risk" && opp.severity === "critical") score += 500;
    if (intent === "pause_campaigns" && opp.futureAction === "pause_campaign") score += 200;
    if (intent === "product_ads_budget" && opp.category === "product_ads") score += 150;
    return { opp, score };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.opp);
}

export function insightToEvidence(opp: CommerceOpportunity) {
  return opp.why.length > 0 ? opp.why : opp.supportingMetrics;
}
