import { buildAttributionDashboard } from "@/lib/attribution/engine";
import { resolveMerchantBusinessProfile } from "@/lib/business-model/profile";
import {
  buildCashFlowBreakdown,
  buildExecutiveHealthBreakdown,
} from "@/lib/analytics/executive-advisor";
import { buildCustomerIntelligence } from "@/lib/customers/engine";
import { getMerchantDnaProfile } from "@/lib/db/merchant-dna";
import { getPreviousDailySnapshot } from "@/lib/db/recommendations";
import { buildBusinessRiskAssessment } from "@/lib/insights/business-risk-assessment";
import { buildMerchantBenchmark } from "@/lib/merchant-dna/benchmark";
import { inferProductDna } from "@/lib/merchant-dna/inference/product-dna";
import { inferGrowthStage } from "@/lib/merchant-dna/inference/growth-stage";
import { buildProductIntelligence } from "@/lib/products/engine";
import { evaluateOpportunities } from "@/lib/opportunities/engine";
import { getCachedRecommendations } from "@/lib/services/dashboard";
import { getCachedStoreBundle } from "@/lib/services/store-bundle";
import { computeStoreHealthScore } from "@/lib/store-health/score";
import type { Recommendation } from "@/lib/types";
import type { MerchantDNA } from "@/lib/merchant-dna/types";
import { buildActionPlan, buildRiskDistribution } from "./action-plan";
import {
  enrichDomains,
  findBiggestOpportunity,
  findPrimaryIssue,
} from "./enrich-domains";
import { buildExecutiveDecision, buildBusinessStrengths } from "./executive-decision";
import { buildHealthExecutiveSummary } from "./executive-summary";
import { appendCurrentScore, listHealthScoreHistory } from "./health-history";
import { interpretBenchmarkPercentile } from "./domain-guidance";
import { buildScoreBreakdown } from "./score-breakdown";
import type { BusinessHealthDashboard, BusinessHealthTrend } from "./types";

function activeRecommendations(recs: Recommendation[]): Recommendation[] {
  return recs.filter((rec) => {
    const status = rec.status ?? "pending";
    return !["ignored", "approved", "completed", "implemented", "measured"].includes(status);
  });
}

function cashFlowScore(estimatedProfit: number, revenue: number, status: string): number {
  if (status === "unavailable") return 35;
  if (revenue <= 0) return 40;
  const marginPct = (estimatedProfit / revenue) * 100;
  if (estimatedProfit < 0) return Math.max(10, 30 + marginPct);
  return Math.min(95, 50 + marginPct * 1.5);
}

function overallTrend(
  currentScore: number,
  previousScore: number | undefined,
  revenueChangePct: number | null,
): BusinessHealthTrend {
  if (previousScore != null) {
    const delta = currentScore - previousScore;
    if (delta >= 3) {
      return {
        direction: "improving",
        label: "Improving",
        detail: `Overall score up ${delta} points`,
        deltaPoints: delta,
      };
    }
    if (delta <= -3) {
      return {
        direction: "declining",
        label: "Declining",
        detail: `Overall score down ${Math.abs(delta)} points`,
        deltaPoints: delta,
      };
    }
    return { direction: "stable", label: "Stable", detail: "Score holding steady", deltaPoints: delta };
  }
  if (revenueChangePct != null && revenueChangePct >= 5) {
    return {
      direction: "improving",
      label: "Improving",
      detail: `Revenue up ${revenueChangePct.toFixed(0)}% vs prior 30 days`,
      deltaPoints: null,
    };
  }
  if (revenueChangePct != null && revenueChangePct <= -5) {
    return {
      direction: "declining",
      label: "Declining",
      detail: `Revenue down ${Math.abs(revenueChangePct).toFixed(0)}% vs prior 30 days`,
      deltaPoints: null,
    };
  }
  return { direction: "stable", label: "Stable", detail: "No major shift in core signals", deltaPoints: null };
}

function statusEmoji(score: number): string {
  if (score >= 70) return "🟢";
  if (score >= 45) return "🟡";
  return "🔴";
}

async function loadBenchmark(input: {
  storeId: string;
  snapshot: import("@/lib/connectors/types").StoreSnapshot;
  profitDashboard: import("@/lib/profit/types").ProfitDashboard | null;
  productIntelligence: ReturnType<typeof buildProductIntelligence>;
}) {
  const profile = await resolveMerchantBusinessProfile({
    storeId: input.storeId,
    snapshot: input.snapshot,
    profitDashboard: input.profitDashboard,
    productIntelligence: input.productIntelligence,
  });
  const stored = await getMerchantDnaProfile(input.storeId);
  let dna: MerchantDNA | null = stored?.dna ?? null;

  if (!dna) {
    const product = inferProductDna({
      snapshot: input.snapshot,
      businessModel: profile.businessModel,
      productIntelligence: input.productIntelligence,
      averageOrderValue: profile.averageOrderValue ?? input.snapshot.storeMetrics?.aov30d,
    });
    const growthStage = inferGrowthStage({
      storeId: input.storeId,
      businessModel: profile.businessModel,
      snapshot: input.snapshot,
      profitDashboard: input.profitDashboard,
      productIntelligence: input.productIntelligence,
    });
    dna = {
      storeId: input.storeId,
      version: 1,
      businessModel: profile.businessModel,
      storeMaturity: "established",
      growthStage,
      primaryAcquisitionChannel: profile.primaryAcquisitionChannel ?? "meta",
      trafficMix: "hybrid",
      typicalMarginPct: profile.typicalMarginPct,
      averageOrderValue: profile.averageOrderValue,
      customerType: "b2c",
      productCount: input.snapshot.products.length,
      productDna: product.productDna,
      pricePosition: product.pricePosition,
      seasonality: product.seasonality,
      geographicMarkets: ["US"],
      preferredAdPlatforms: profile.advertisingChannels ?? [],
      executionStyle: "measured",
      riskTolerance: "medium",
      automationPreference: "approval_required",
      decisionStyle: "data_driven",
      personality: "balanced",
      learned: stored?.learned ?? {
        aggressivenessBias: 0,
        scalingAffinity: 0,
        discountAffinity: 0,
        inventoryClearanceAffinity: 0,
      },
      manualOverrides: {},
      benchmarkCohort: "",
      inferredAt: new Date().toISOString(),
      personalizationNarrative: "",
    };
  }

  const benchmark = buildMerchantBenchmark({
    dna,
    snapshot: input.snapshot,
    profitDashboard: input.profitDashboard,
  });

  return benchmark;
}

export async function buildBusinessHealthDashboard(): Promise<BusinessHealthDashboard> {
  const bundle = await getCachedStoreBundle();
  const { storeId, snapshot, costRecords, profitDashboard } = bundle;
  const [allRecs, previousSnapshot, historyRaw] = await Promise.all([
    getCachedRecommendations(storeId),
    getPreviousDailySnapshot(storeId),
    listHealthScoreHistory(storeId, 30),
  ]);

  const activeRecs = activeRecommendations(allRecs);
  const productIntelligence = buildProductIntelligence(snapshot, costRecords, profitDashboard);
  const attributionDashboard = buildAttributionDashboard(snapshot, profitDashboard);
  const customerIntelligence = buildCustomerIntelligence({
    snapshot,
    attribution: attributionDashboard,
    profitDashboard,
  });

  const storeHealth = computeStoreHealthScore({
    snapshot,
    profitDashboard,
    productIntelligence,
    attributionDashboard,
    activeRecommendations: activeRecs,
    previousFactorScores: previousSnapshot?.factorScores as Partial<
      Record<import("@/lib/store-health/score").StoreHealthFactor, number>
    >,
    previousScore: previousSnapshot?.healthScore,
  });

  const executiveHealth = buildExecutiveHealthBreakdown(storeHealth, snapshot, profitDashboard);
  const cashFlow = buildCashFlowBreakdown(profitDashboard, snapshot);
  const risk = buildBusinessRiskAssessment({
    snapshot,
    profitDashboard,
    attributionDashboard,
    customerIntelligence,
    productIntelligence,
    storeHealth,
    hasActiveAds: snapshot.campaigns.length > 0 || Boolean(snapshot.googleAdsSnapshot),
  });

  const netMarginPct = profitDashboard?.primary.profitMarginPct ?? undefined;
  const opportunities = evaluateOpportunities(snapshot, {
    limit: 12,
    netMarginPct,
    extra: [
      ...(productIntelligence?.productOpportunities ?? []),
      ...(attributionDashboard?.attributionOpportunities ?? []),
    ],
  });

  const cat = (id: string) => executiveHealth?.categories.find((c) => c.id === id);
  const customersLimited =
    (snapshot.customerSnapshot?.customers.length ?? 0) === 0 &&
    snapshot.customerSnapshot?.dataTier !== "aggregated_only";

  const cfScore = cashFlowScore(cashFlow.estimatedProfit, cashFlow.revenue, cashFlow.status);

  const baseDomains = [
    {
      id: "profit",
      label: "Profit",
      score: cat("profitability")?.score ?? storeHealth.factors.find((f) => f.factor === "profit_trend")?.score ?? 50,
      detail: cat("profitability")?.explanation ?? "Profit signals unavailable — complete profit setup.",
    },
    {
      id: "marketing",
      label: "Marketing",
      score: cat("marketing")?.score ?? 50,
      detail: cat("marketing")?.explanation ?? "Connect advertising platforms for marketing health.",
    },
    {
      id: "inventory",
      label: "Inventory",
      score: cat("inventory")?.score ?? 50,
      detail: cat("inventory")?.explanation ?? "Inventory health based on stock levels and sell-through.",
    },
    {
      id: "customers",
      label: "Customers",
      score: cat("retention")?.score ?? 50,
      detail: customersLimited
        ? "Customer records are limited — sync Shopify customers for full retention analysis."
        : cat("retention")?.explanation ?? "Customer retention signals from orders and GA4.",
      limited: customersLimited,
    },
    {
      id: "cash-flow",
      label: "Cash Flow",
      score: cfScore,
      detail:
        cashFlow.status === "unavailable"
          ? "Cash flow unavailable — revenue and cost data required."
          : `Estimated profit on synced revenue and cost data.`,
    },
  ];

  const domains = enrichDomains({
    baseDomains,
    risk,
    activeRecs,
    opportunities,
    previousFactorScores: previousSnapshot?.factorScores as Partial<
      Record<import("@/lib/store-health/score").StoreHealthFactor, number>
    >,
    customersLimited,
  });

  const breakdown = buildScoreBreakdown(
    domains.map((d) => ({ id: d.id, label: d.label, score: d.score })),
    storeHealth.factors.map((f) => ({ factor: f.factor, weight: f.weight })),
  );

  const trends = snapshot.salesTrends;
  const revenueChangePct =
    trends && trends.previous30Days.revenue > 0
      ? ((trends.last30Days.revenue - trends.previous30Days.revenue) /
          trends.previous30Days.revenue) *
        100
      : null;

  const trend = overallTrend(storeHealth.score, storeHealth.previousScore, revenueChangePct);
  const biggestOpportunity = findBiggestOpportunity(opportunities, domains);
  const primaryIssue = findPrimaryIssue(domains);
  const riskDistribution = buildRiskDistribution(domains);
  const generatedAt = new Date().toISOString();

  const benchmarkData = await loadBenchmark({
    storeId,
    snapshot,
    profitDashboard,
    productIntelligence,
  });

  const inventoryDomain = domains.find((d) => d.id === "inventory");

  const benchmarkRows = [
    {
      id: "profit",
      label: "Profit",
      percentile: benchmarkData.metrics.find((m) => m.id === "margin")?.cohortPercentile ?? 50,
    },
    {
      id: "marketing",
      label: "Marketing",
      percentile: benchmarkData.metrics.find((m) => m.id === "roas")?.cohortPercentile ?? 50,
    },
    {
      id: "conversion",
      label: "Conversion Rate",
      percentile: benchmarkData.metrics.find((m) => m.id === "conversion")?.cohortPercentile ?? 50,
    },
    {
      id: "aov",
      label: "Average Order Value",
      percentile: benchmarkData.metrics.find((m) => m.id === "aov")?.cohortPercentile ?? 50,
    },
    {
      id: "inventory",
      label: "Inventory",
      percentile: Math.max(5, Math.min(95, inventoryDomain?.score ?? 50)),
    },
  ].map((row) => {
    const interp = interpretBenchmarkPercentile(row.label, row.percentile);
    return {
      ...row,
      interpretationKind: interp.kind,
      interpretation: interp.text,
    };
  });

  const strengths = buildBusinessStrengths({ domains, benchmarkRows });
  const executiveDecision = buildExecutiveDecision({
    overallScore: storeHealth.score,
    risk,
    domains,
  });

  return {
    generatedAt,
    storeId,
    overall: {
      score: storeHealth.score,
      maxScore: 100,
      label: storeHealth.label,
      statusEmoji: statusEmoji(storeHealth.score),
      primaryIssue,
      biggestOpportunity,
      trend,
      lastUpdated: generatedAt,
    },
    executiveSummary: buildHealthExecutiveSummary({
      overallScore: storeHealth.score,
      risk,
      domains,
      biggestOpportunity,
      criticalCount: riskDistribution.critical,
    }),
    breakdown,
    domains,
    history: appendCurrentScore(historyRaw, storeHealth.score),
    benchmark: {
      cohortLabel: benchmarkData.cohortLabel,
      similarStoreCount: benchmarkData.similarMerchantCount,
      rows: benchmarkRows,
    },
    riskDistribution,
    actionPlan: buildActionPlan({
      domains,
      activeRecs,
      opportunities,
      risk,
      customersLimited,
    }),
    strengths,
    executiveDecision,
    riskAssessment: risk,
  };
}
