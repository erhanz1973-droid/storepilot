/**
 * Alpine Outfitters — every user-visible UI metric for Demo Mode.
 * Screens must read these via the Demo Data Provider — never recalculate in Demo Mode.
 */

import { ALPINE_CURATED_RECOMMENDATIONS } from "./recommendations";

function sumCurated(
  pick: "profit" | "revenue" | "savings" | "recovery",
): number {
  return ALPINE_CURATED_RECOMMENDATIONS.reduce((sum, rec) => {
    const fi = rec.financialImpact;
    if (!fi) return sum;
    if (pick === "profit") return sum + (fi.estimatedMonthlyProfitIncrease ?? 0);
    if (pick === "revenue") return sum + (fi.estimatedMonthlyRevenueIncrease ?? 0);
    if (pick === "savings") return sum + (fi.estimatedMonthlyCostSavings ?? 0);
    const recovery = Math.max(
      fi.estimatedMonthlyRevenueIncrease ?? 0,
      fi.estimatedMonthlyCostSavings ?? 0,
      fi.estimatedMonthlyProfitIncrease ?? 0,
    );
    return sum + recovery;
  }, 0);
}

/** Top curated rec by priority then impact — drives Today's #1 executive decision. */
export function getAlpineHeroRecommendation() {
  const rank = { critical: 0, high: 1, medium: 2, low: 3 } as const;
  return [...ALPINE_CURATED_RECOMMENDATIONS].sort((a, b) => {
    const p = rank[a.priority] - rank[b.priority];
    if (p !== 0) return p;
    const aImp =
      a.financialImpact?.estimatedMonthlyProfitIncrease ??
      a.financialImpact?.estimatedMonthlyRevenueIncrease ??
      0;
    const bImp =
      b.financialImpact?.estimatedMonthlyProfitIncrease ??
      b.financialImpact?.estimatedMonthlyRevenueIncrease ??
      0;
    return bImp - aImp;
  })[0]!;
}

const hero = getAlpineHeroRecommendation();
const heroRecovery = Math.max(
  hero.financialImpact?.estimatedMonthlyRevenueIncrease ?? 0,
  hero.financialImpact?.estimatedMonthlyCostSavings ?? 0,
  hero.financialImpact?.estimatedMonthlyProfitIncrease ?? 0,
);

/**
 * Canonical UI metrics — Demo Mode single source of truth.
 * Values are deterministic and match App Store / website showcase copy.
 */
export const ALPINE_UI_METRICS = {
  /** Core store KPIs */
  revenue30d: 82_450,
  profit30d: 16_870,
  orders30d: 1_248,
  aov: 66.1,
  conversionRatePct: 3.4,
  blendedRoas: 4.38,
  storeHealthScore: 94,
  aiConfidencePct: 98,

  /** Executive hero — Today's #1 Recoverable Profit Opportunity */
  recoverableProfitOpportunity: heroRecovery,
  recoverableProfitOpportunityLabel: hero.title,
  heroRecommendationId: hero.id,
  heroNetProfitImprovement:
    hero.financialImpact?.estimatedMonthlyProfitIncrease ?? heroRecovery,

  /** Aggregated opportunity / risk panels */
  totalRecoverableOpportunityMonthly: sumCurated("recovery"),
  totalNetProfitImprovementMonthly: sumCurated("profit"),
  totalRevenueOpportunityMonthly: sumCurated("revenue"),
  totalSavingsMonthly: sumCurated("savings"),
  cashAtRiskMonthly: 4_800,
  inventoryRiskMonthly: 4_800,
  recoveryOpportunityMonthly: sumCurated("recovery"),
  recoveryBestCaseMonthly: Math.round(sumCurated("recovery") * 1.25),

  /** Counts */
  recommendationCount: ALPINE_CURATED_RECOMMENDATIONS.length,
  criticalRecommendationCount: ALPINE_CURATED_RECOMMENDATIONS.filter(
    (r) => r.priority === "critical",
  ).length,
  opportunityCount: ALPINE_CURATED_RECOMMENDATIONS.length,

  /** Marketing rollups (30d) */
  metaSpend30d: 9_850,
  metaRevenue30d: 34_900,
  metaRoas: 3.54,
  googleSpend30d: 5_420,
  googleRevenue30d: 23_600,
  googleRoas: 4.35,
  totalAdSpend30d: 9_850 + 5_420,
  totalAdRevenue30d: 34_900 + 23_600,

  /** Traffic */
  sessions30d: 54_800,
  users30d: 41_900,
  returningVisitorPct: 32,

  /** Trends (upward) */
  revenueChangePct: 14,
  profitChangePct: 12,
  ordersChangePct: 11,
  roasChangePct: 9,
} as const;

export type AlpineUiMetrics = typeof ALPINE_UI_METRICS;
