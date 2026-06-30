import { parseRevenueImpact } from "@/lib/approvals/revenue";
import type { BusinessRiskAssessment } from "@/lib/insights/business-risk-assessment";
import type { Opportunity } from "@/lib/types";
import type { Recommendation } from "@/lib/types";
import type { BusinessHealthDomain, HealthActionItem } from "./types";

export function buildActionPlan(input: {
  domains: BusinessHealthDomain[];
  activeRecs: Recommendation[];
  opportunities: Opportunity[];
  risk: BusinessRiskAssessment;
  customersLimited: boolean;
}): HealthActionItem[] {
  const items: HealthActionItem[] = [];
  const seen = new Set<string>();

  const push = (title: string, impactMonthly: number | null, category: string) => {
    const key = title.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    items.push({
      rank: items.length + 1,
      title,
      impactMonthly,
      category,
      impactLabel:
        impactMonthly != null && impactMonthly > 0
          ? `+$${impactMonthly.toLocaleString(undefined, { maximumFractionDigits: 0 })}/month`
          : impactMonthly === 0
            ? "Prevent stockout"
            : "Unlock intelligence",
    });
  };

  const sortedRecs = [...input.activeRecs].sort(
    (a, b) => parseRevenueImpact(b.expectedImpact) - parseRevenueImpact(a.expectedImpact),
  );
  for (const rec of sortedRecs.slice(0, 2)) {
    push(rec.actionLabel || rec.title, parseRevenueImpact(rec.expectedImpact), rec.category);
  }

  const sortedOpps = [...input.opportunities].sort(
    (a, b) => b.estimatedMonthlyNetProfitImpact - a.estimatedMonthlyNetProfitImpact,
  );
  for (const opp of sortedOpps.slice(0, 2)) {
    if (items.length >= 3) break;
    push(opp.title, opp.estimatedMonthlyNetProfitImpact, opp.category);
  }

  if (items.length < 3) {
    for (const step of input.risk.recommendationSteps) {
      if (items.length >= 3) break;
      const domain = input.domains.find((d) =>
        d.recommendedAction.toLowerCase().includes(step.action.slice(0, 20).toLowerCase()),
      );
      push(
        step.action,
        domain?.estimatedImpactMonthly ?? null,
        "recommended",
      );
    }
  }

  if (input.customersLimited && items.length < 5) {
    push("Connect Shopify Customers", null, "data");
  }

  return items.slice(0, 5).map((item, i) => ({ ...item, rank: i + 1 }));
}

export function buildRiskDistribution(domains: BusinessHealthDomain[]): {
  critical: number;
  warning: number;
  healthy: number;
  limited: number;
} {
  return domains.reduce(
    (acc, d) => {
      acc[d.status] += 1;
      return acc;
    },
    { critical: 0, warning: 0, healthy: 0, limited: 0 },
  );
}
