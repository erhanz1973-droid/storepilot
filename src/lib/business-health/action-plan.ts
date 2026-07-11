import { parseRevenueImpact } from "@/lib/approvals/revenue";
import type { BusinessRiskAssessment } from "@/lib/insights/business-risk-assessment";
import type { Opportunity } from "@/lib/types";
import type { Recommendation } from "@/lib/types";
import { buildPriorityMeta, financialImpactType } from "./domain-guidance";
import type { BusinessHealthDomain, HealthActionItem } from "./types";

const DOMAIN_FOR_REC: Partial<Record<Recommendation["category"], string>> = {
  campaign_review: "marketing",
  low_inventory: "inventory",
  slow_selling: "inventory",
  bundle_opportunity: "profit",
  promotion_opportunity: "marketing",
  homepage_merchandising: "marketing",
};

const DOMAIN_FOR_OPP: Partial<Record<Opportunity["category"], string>> = {
  advertising_efficiency: "marketing",
  marketing: "marketing",
  marketing_attribution: "marketing",
  inventory: "inventory",
  pricing: "profit",
  bundle: "profit",
  customer_retention: "customers",
};

function impactLabel(
  amount: number | null,
  domainId: string,
): string {
  if (amount != null && amount > 0) {
    return `+$${amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}/month`;
  }
  if (amount === 0) return "Prevent stockout";
  return "Unlock intelligence";
}

export function buildActionPlan(input: {
  domains: BusinessHealthDomain[];
  activeRecs: Recommendation[];
  opportunities: Opportunity[];
  risk: BusinessRiskAssessment;
  customersLimited: boolean;
}): HealthActionItem[] {
  const items: HealthActionItem[] = [];
  const seen = new Set<string>();

  const push = (
    title: string,
    impactMonthly: number | null,
    category: string,
    domainId: string,
    confidencePct?: number,
  ) => {
    const key = title.toLowerCase().slice(0, 40);
    if (seen.has(key)) return;
    seen.add(key);
    const meta = buildPriorityMeta({ domainId, impactMonthly, confidencePct });
    items.push({
      rank: items.length + 1,
      title,
      impactMonthly,
      category,
      financialImpactType: financialImpactType(domainId),
      impactLabel: impactLabel(impactMonthly, domainId),
      ...meta,
    });
  };

  const sortedDomains = [...input.domains].sort((a, b) => a.score - b.score);
  for (const domain of sortedDomains.slice(0, 3)) {
    push(
      domain.recommendedAction,
      domain.estimatedImpactMonthly,
      domain.id,
      domain.id,
      input.risk.primaryRisk.confidencePct,
    );
  }

  const sortedRecs = [...input.activeRecs].sort(
    (a, b) => parseRevenueImpact(b.expectedImpact) - parseRevenueImpact(a.expectedImpact),
  );
  for (const rec of sortedRecs.slice(0, 2)) {
    if (items.length >= 5) break;
    const domainId = DOMAIN_FOR_REC[rec.category] ?? "profit";
    push(
      rec.actionLabel || rec.title,
      parseRevenueImpact(rec.expectedImpact),
      rec.category,
      domainId,
    );
  }

  const sortedOpps = [...input.opportunities].sort(
    (a, b) => b.estimatedMonthlyNetProfitImpact - a.estimatedMonthlyNetProfitImpact,
  );
  for (const opp of sortedOpps.slice(0, 2)) {
    if (items.length >= 5) break;
    const domainId = DOMAIN_FOR_OPP[opp.category] ?? "profit";
    push(opp.title, opp.estimatedMonthlyNetProfitImpact, opp.category, domainId);
  }

  if (input.customersLimited && items.length < 5) {
    push("Connect Shopify Customers", null, "data", "customers", 85);
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
