import type { StoreSnapshot } from "@/lib/connectors/types";
import type { ProfitDashboard } from "@/lib/profit/types";
import type { ProductIntelligenceDashboard } from "@/lib/products/types";
import type { AttributionDashboard } from "@/lib/attribution/models";
import type { Recommendation } from "@/lib/types";

export type StoreHealthFactor =
  | "revenue_trend"
  | "profit_trend"
  | "blended_roas"
  | "conversion_rate"
  | "inventory_health"
  | "marketing_efficiency"
  | "customer_retention"
  | "critical_issues";

export type StoreHealthFactorScore = {
  factor: StoreHealthFactor;
  label: string;
  score: number;
  weight: number;
};

export type StoreHealthChange = {
  delta: number;
  reason: string;
};

export type StoreHealthScore = {
  score: number;
  label: "Excellent" | "Healthy" | "Fair" | "At Risk";
  factors: StoreHealthFactorScore[];
  changes: StoreHealthChange[];
  previousScore?: number;
};

const FACTOR_WEIGHTS: Record<StoreHealthFactor, { weight: number; label: string }> = {
  revenue_trend: { weight: 0.18, label: "Revenue trend" },
  profit_trend: { weight: 0.15, label: "Profit trend" },
  blended_roas: { weight: 0.15, label: "Blended ROAS" },
  conversion_rate: { weight: 0.1, label: "Conversion rate" },
  inventory_health: { weight: 0.12, label: "Inventory health" },
  marketing_efficiency: { weight: 0.12, label: "Marketing efficiency" },
  customer_retention: { weight: 0.1, label: "Customer retention" },
  critical_issues: { weight: 0.08, label: "Critical issues" },
};

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function scoreRevenueTrend(snapshot: StoreSnapshot): number {
  const trends = snapshot.salesTrends;
  if (!trends || trends.previous30Days.revenue <= 0) return 65;
  const change =
    ((trends.last30Days.revenue - trends.previous30Days.revenue) /
      trends.previous30Days.revenue) *
    100;
  return clamp(50 + change * 2.5);
}

function scoreProfitTrend(profitDashboard: ProfitDashboard | null): number {
  if (!profitDashboard) return 60;
  const margin = profitDashboard.primary.profitMarginPct;
  if (margin == null) return 55;
  return clamp(margin * 2.8);
}

function scoreBlendedRoas(profitDashboard: ProfitDashboard | null): number {
  const roas = profitDashboard?.blendedRoas?.blendedRoas30d;
  if (roas == null) return 55;
  return clamp(Math.min(100, roas * 38));
}

function scoreConversionRate(snapshot: StoreSnapshot): number {
  const ga4Cvr = snapshot.ga4Snapshot?.ecommerceConversionRatePct;
  if (ga4Cvr != null && ga4Cvr > 0) return clamp(ga4Cvr * 25);
  const rate = snapshot.storeMetrics?.conversionRate30d;
  if (rate == null) return 60;
  return clamp(rate * 2500);
}

function scoreInventoryHealth(
  productIntelligence: ProductIntelligenceDashboard | null,
): number {
  if (!productIntelligence) return 70;
  const riskCount = productIntelligence.inventoryRisk.length;
  const total = productIntelligence.products.length || 1;
  const riskRatio = riskCount / total;
  return clamp(100 - riskRatio * 120 - riskCount * 4);
}

function scoreMarketingEfficiency(
  profitDashboard: ProfitDashboard | null,
  attributionDashboard: AttributionDashboard | null,
): number {
  const roas = profitDashboard?.blendedRoas?.blendedRoas30d;
  const cac = attributionDashboard?.acquisition.cac;
  let score = 60;
  if (roas != null) score = clamp(roas * 30);
  if (cac != null && cac > 0) score = clamp((score + Math.max(20, 100 - cac / 1.5)) / 2);
  return score;
}

function scoreCustomerRetention(
  snapshot: StoreSnapshot,
  attributionDashboard: AttributionDashboard | null,
): number {
  const ga4Returning = snapshot.ga4Snapshot?.returningUserRatePct;
  if (ga4Returning != null && ga4Returning > 0) {
    return clamp(35 + ga4Returning * 0.65);
  }
  if (!attributionDashboard) return 55;
  const { newCustomers, returningCustomers } = attributionDashboard.acquisition;
  const total = newCustomers + returningCustomers;
  if (total <= 0) return 55;
  const ratio = returningCustomers / total;
  return clamp(35 + ratio * 90);
}

function scoreCriticalIssues(activeRecs: Recommendation[]): number {
  const critical = activeRecs.filter((r) => r.severity === "critical").length;
  const high = activeRecs.filter((r) => r.severity === "high").length;
  return clamp(100 - critical * 18 - high * 8);
}

export function computeStoreHealthScore(input: {
  snapshot: StoreSnapshot;
  profitDashboard: ProfitDashboard | null;
  productIntelligence: ProductIntelligenceDashboard | null;
  attributionDashboard: AttributionDashboard | null;
  activeRecommendations: Recommendation[];
  previousFactorScores?: Partial<Record<StoreHealthFactor, number>>;
  previousScore?: number;
}): StoreHealthScore {
  const rawScores: Record<StoreHealthFactor, number> = {
    revenue_trend: scoreRevenueTrend(input.snapshot),
    profit_trend: scoreProfitTrend(input.profitDashboard),
    blended_roas: scoreBlendedRoas(input.profitDashboard),
    conversion_rate: scoreConversionRate(input.snapshot),
    inventory_health: scoreInventoryHealth(input.productIntelligence),
    marketing_efficiency: scoreMarketingEfficiency(
      input.profitDashboard,
      input.attributionDashboard,
    ),
    customer_retention: scoreCustomerRetention(input.snapshot, input.attributionDashboard),
    critical_issues: scoreCriticalIssues(input.activeRecommendations),
  };

  const factors: StoreHealthFactorScore[] = (
    Object.keys(FACTOR_WEIGHTS) as StoreHealthFactor[]
  ).map((factor) => ({
    factor,
    label: FACTOR_WEIGHTS[factor].label,
    score: rawScores[factor],
    weight: FACTOR_WEIGHTS[factor].weight,
  }));

  const score = clamp(
    factors.reduce((sum, f) => sum + f.score * f.weight, 0),
  );

  const changes = buildScoreChanges(
    rawScores,
    input.previousFactorScores,
    input.snapshot,
    input.profitDashboard,
    input.productIntelligence,
    input.activeRecommendations,
  );

  let label: StoreHealthScore["label"] = "Fair";
  if (score >= 90) label = "Excellent";
  else if (score >= 85) label = "Healthy";
  else if (score < 45) label = "At Risk";

  return {
    score,
    label,
    factors,
    changes,
    previousScore: input.previousScore,
  };
}

function buildScoreChanges(
  current: Record<StoreHealthFactor, number>,
  previous: Partial<Record<StoreHealthFactor, number>> | undefined,
  snapshot: StoreSnapshot,
  profitDashboard: ProfitDashboard | null,
  productIntelligence: ProductIntelligenceDashboard | null,
  activeRecs: Recommendation[],
): StoreHealthChange[] {
  if (!previous) return [];

  const changes: StoreHealthChange[] = [];

  for (const factor of Object.keys(FACTOR_WEIGHTS) as StoreHealthFactor[]) {
    const prev = previous[factor];
    if (prev == null) continue;
    const delta = Math.round((current[factor] - prev) * FACTOR_WEIGHTS[factor].weight);
    if (delta === 0) continue;

    const reason = explainFactorChange(
      factor,
      delta,
      snapshot,
      profitDashboard,
      productIntelligence,
      activeRecs,
    );
    changes.push({ delta, reason });
  }

  return changes.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 6);
}

function explainFactorChange(
  factor: StoreHealthFactor,
  delta: number,
  snapshot: StoreSnapshot,
  profitDashboard: ProfitDashboard | null,
  productIntelligence: ProductIntelligenceDashboard | null,
  activeRecs: Recommendation[],
): string {
  const up = delta > 0;
  switch (factor) {
    case "revenue_trend": {
      const trends = snapshot.salesTrends;
      if (trends && trends.previous30Days.revenue > 0) {
        const pct = Math.round(
          ((trends.last30Days.revenue - trends.previous30Days.revenue) /
            trends.previous30Days.revenue) *
            100,
        );
        return up ? `Revenue increased ${pct}% vs prior period.` : `Revenue decreased ${Math.abs(pct)}%.`;
      }
      return up ? "Revenue trend improved." : "Revenue trend declined.";
    }
    case "profit_trend": {
      const margin = profitDashboard?.primary.profitMarginPct;
      return margin != null
        ? up
          ? `Profit margin improved to ${margin.toFixed(1)}%.`
          : `Profit margin declined to ${margin.toFixed(1)}%.`
        : up
          ? "Profit trend improved."
          : "Profit trend declined.";
    }
    case "blended_roas": {
      const roas = profitDashboard?.blendedRoas?.blendedRoas30d;
      return roas != null
        ? up
          ? `ROAS increased to ${roas.toFixed(2)}.`
          : `ROAS decreased to ${roas.toFixed(2)}.`
        : up
          ? "ROAS improved."
          : "ROAS decreased.";
    }
    case "conversion_rate":
      return up ? "Conversion rate increased." : "Conversion rate decreased.";
    case "inventory_health": {
      const risk = productIntelligence?.inventoryRisk.length ?? 0;
      return risk > 0
        ? `Inventory risk detected (${risk} SKUs).`
        : up
          ? "Inventory health improved."
          : "Inventory health declined.";
    }
    case "marketing_efficiency":
      return up ? "Marketing efficiency improved." : "Marketing efficiency declined.";
    case "customer_retention":
      return up ? "Customer retention improved." : "Customer retention declined.";
    case "critical_issues": {
      const critical = activeRecs.filter((r) => r.severity === "critical").length;
      return critical > 0
        ? `${critical} critical issue${critical > 1 ? "s" : ""} active.`
        : up
          ? "Critical issues resolved."
          : "New critical issues detected.";
    }
    default:
      return up ? "Score improved." : "Score declined.";
  }
}

export function factorScoresToBreakdown(
  factors: StoreHealthFactorScore[],
): Record<string, number> {
  return Object.fromEntries(factors.map((f) => [f.factor, f.score]));
}
