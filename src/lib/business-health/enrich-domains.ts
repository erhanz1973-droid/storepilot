import { parseRevenueImpact } from "@/lib/approvals/revenue";
import type { BusinessRiskAssessment, BusinessRiskCategory } from "@/lib/insights/business-risk-assessment";
import type { Opportunity } from "@/lib/types";
import type { Recommendation } from "@/lib/types";
import type { StoreHealthFactor } from "@/lib/store-health/score";
import type {
  BusinessHealthDomain,
  BusinessHealthStatus,
  DomainTrend,
} from "./types";

const DOMAIN_RISK: Record<string, BusinessRiskCategory> = {
  profit: "profitability",
  marketing: "marketing",
  inventory: "inventory",
  customers: "customer_retention",
  "cash-flow": "cash_flow",
};

const FACTOR_MAP: Record<string, StoreHealthFactor[]> = {
  profit: ["profit_trend", "revenue_trend"],
  marketing: ["marketing_efficiency", "blended_roas"],
  inventory: ["inventory_health"],
  customers: ["customer_retention"],
  "cash-flow": ["profit_trend"],
};

const REC_DOMAIN: Partial<Record<Recommendation["category"], string>> = {
  campaign_review: "marketing",
  low_inventory: "inventory",
  slow_selling: "inventory",
  bundle_opportunity: "profit",
  promotion_opportunity: "marketing",
  homepage_merchandising: "marketing",
};

const OPP_DOMAIN: Partial<Record<Opportunity["category"], string>> = {
  advertising_efficiency: "marketing",
  marketing: "marketing",
  marketing_attribution: "marketing",
  inventory: "inventory",
  pricing: "profit",
  bundle: "profit",
  customer_retention: "customers",
};

export function statusFromScore(score: number, limited = false): BusinessHealthStatus {
  if (limited) return "limited";
  if (score >= 70) return "healthy";
  if (score >= 45) return "warning";
  return "critical";
}

function formatImpact(amount: number): string {
  if (amount <= 0) return "Prevent revenue loss";
  return `+$${amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}/month`;
}

function domainTrend(
  domainId: string,
  currentScore: number,
  previousFactorScores?: Partial<Record<StoreHealthFactor, number>>,
): DomainTrend {
  const factors = FACTOR_MAP[domainId] ?? [];
  let delta: number | null = null;
  if (previousFactorScores && factors.length > 0) {
    const deltas = factors
      .map((f) => {
        const prev = previousFactorScores[f];
        if (prev == null) return null;
        return currentScore - prev;
      })
      .filter((d): d is number => d != null);
    if (deltas.length > 0) {
      delta = Math.round(deltas.reduce((s, d) => s + d, 0) / deltas.length);
    }
  }

  const windowLabel = domainId === "marketing" ? "7-Day Trend" : "30-Day Trend";
  if (delta != null && delta >= 3) {
    return { windowLabel, direction: "improving", label: "Improving", deltaPoints: delta };
  }
  if (delta != null && delta <= -3) {
    return { windowLabel, direction: "declining", label: "Declining", deltaPoints: delta };
  }
  return { windowLabel, direction: "stable", label: "Stable", deltaPoints: delta };
}

function pickRecForDomain(domainId: string, recs: Recommendation[]): Recommendation | null {
  const matched = recs.filter((r) => REC_DOMAIN[r.category] === domainId);
  if (matched.length === 0) return null;
  return [...matched].sort(
    (a, b) => parseRevenueImpact(b.expectedImpact) - parseRevenueImpact(a.expectedImpact),
  )[0]!;
}

function pickOppForDomain(domainId: string, opps: Opportunity[]): Opportunity | null {
  const matched = opps.filter((o) => OPP_DOMAIN[o.category] === domainId);
  if (matched.length === 0) return null;
  return [...matched].sort(
    (a, b) => b.estimatedMonthlyNetProfitImpact - a.estimatedMonthlyNetProfitImpact,
  )[0]!;
}

export function enrichDomains(input: {
  baseDomains: { id: string; label: string; score: number; detail: string; limited?: boolean }[];
  risk: BusinessRiskAssessment;
  activeRecs: Recommendation[];
  opportunities: Opportunity[];
  previousFactorScores?: Partial<Record<StoreHealthFactor, number>>;
}): BusinessHealthDomain[] {
  const riskByCategory = new Map(input.risk.categories.map((c) => [c.category, c]));

  return input.baseDomains.map((base) => {
    const riskCat = DOMAIN_RISK[base.id];
    const riskRow = riskCat ? riskByCategory.get(riskCat) : undefined;
    const rec = pickRecForDomain(base.id, input.activeRecs);
    const opp = pickOppForDomain(base.id, input.opportunities);

    const playbookAction =
      riskCat && input.risk.recommendationSteps.length > 0
        ? input.risk.recommendationSteps[0]?.action
        : "Review this area in Analytics for specific next steps.";

    const recommendedAction = rec?.actionLabel ?? rec?.title ?? opp?.title ?? playbookAction;
    const impactMonthly =
      (rec ? parseRevenueImpact(rec.expectedImpact) : 0) ||
      opp?.estimatedMonthlyNetProfitImpact ||
      riskRow?.financialExposure[0]?.amountMonthly ||
      null;

    const why =
      riskRow && riskRow.score >= 50
        ? riskRow.summary
        : base.detail;

    return {
      id: base.id,
      label: base.label,
      score: base.score,
      status: statusFromScore(base.score, base.limited),
      why,
      recommendedAction,
      estimatedImpact: impactMonthly != null ? formatImpact(impactMonthly) : null,
      estimatedImpactMonthly: impactMonthly,
      trend: domainTrend(base.id, base.score, input.previousFactorScores),
    };
  });
}

export function findPrimaryIssue(domains: BusinessHealthDomain[]): string {
  const sorted = [...domains].sort((a, b) => a.score - b.score);
  const worst = sorted.find((d) => d.status === "critical") ?? sorted[0];
  return worst?.label ?? "Profitability";
}

export function findBiggestOpportunity(
  opportunities: Opportunity[],
  domains: BusinessHealthDomain[],
): string {
  const topOpp = [...opportunities].sort(
    (a, b) => b.estimatedMonthlyNetProfitImpact - a.estimatedMonthlyNetProfitImpact,
  )[0];
  if (topOpp) return topOpp.title;
  const actionable = domains.find((d) => d.estimatedImpactMonthly && d.estimatedImpactMonthly > 0);
  return actionable?.recommendedAction ?? "Advertising optimization";
}
