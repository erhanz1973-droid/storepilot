import type { BusinessModel } from "@/lib/business-model/types";

export type PerformanceTier = "normal" | "poor" | "critical" | "catastrophic";

export type BusinessSegment = "small" | "medium" | "large" | "enterprise";

export type ForecastBusinessContext = {
  monthlyRevenue: number;
  monthlyProfit: number;
  monthlyAdSpend: number;
  blendedRoas: number | null;
  conversionRatePct: number | null;
  grossMarginPct: number | null;
  contributionMarginPct: number | null;
  cogsPct: number | null;
  shippingCostPct: number | null;
  catastrophicInefficiency: boolean;
  performanceTier: PerformanceTier;
  businessSegment: BusinessSegment;
  businessModel: BusinessModel;
  profitTrendPct: number | null;
  budgetEfficiencyScore: number | null;
};

export type RecoveryOpportunityType =
  | "campaign_optimization"
  | "budget_reallocation"
  | "pricing_optimization"
  | "inventory_optimization"
  | "creative_optimization"
  | "email_marketing"
  | "customer_retention"
  | "general";

export type RecoveryQualityLabel = "conservative" | "moderate" | "aggressive";

export type RecoveryRange = {
  low: number;
  high: number;
  mostLikely: number;
};

export type RecoveryComponents = {
  recoverableAdSpend: number;
  expectedProfitIncrease: number;
  revenueImpact: number;
  roasBefore: string | null;
  roasAfter: string | null;
};

export type RecoveryBenchmark = {
  segmentLabel: string;
  averageRecovery: number;
  yourRecovery: number;
  percentileBetterThan: number;
};

export type RecoveryCalculationModel = {
  monthlyAdSpend: number;
  estimatedWastedSpendPct: number;
  recoverableSpend: number;
  roasBefore: string | null;
  roasAfter: string | null;
  conversionImprovementPct: number;
  historicalWindowDays: number;
  projectedMonthlyProfitIncrease: number;
  grossMarginPct: number | null;
  contributionMarginPct: number | null;
  performanceTier: PerformanceTier;
  businessSegment: BusinessSegment;
  opportunityType: RecoveryOpportunityType;
  dynamicCapPct: number;
  businessModel: BusinessModel;
};

export type RecoveryQuality = {
  label: RecoveryQualityLabel;
  emoji: string;
  description: string;
};

export type RecoveryForecast = {
  range: RecoveryRange;
  confidencePct: number;
  quality: RecoveryQuality;
  components: RecoveryComponents;
  benchmark: RecoveryBenchmark;
  calculation: RecoveryCalculationModel;
  amount: number;
  originalAmount: number;
  wasCapped: boolean;
  capReasons: string[];
};

const TIER_AD_RECOVERY_CAP: Record<PerformanceTier, number> = {
  normal: 0.3,
  poor: 0.4,
  critical: 0.5,
  catastrophic: 0.7,
};

const SEGMENT_MAX_RECOVERY: Record<BusinessSegment, number> = {
  small: 1_500,
  medium: 15_000,
  large: 80_000,
  enterprise: 500_000,
};

const SEGMENT_BENCHMARK_AVG: Record<BusinessSegment, number> = {
  small: 382,
  medium: 1_850,
  large: 8_200,
  enterprise: 34_000,
};

const OPPORTUNITY_RANGES: Record<RecoveryOpportunityType, { min: number; max: number }> = {
  campaign_optimization: { min: 0.1, max: 0.3 },
  budget_reallocation: { min: 0.15, max: 0.4 },
  pricing_optimization: { min: 0.03, max: 0.12 },
  inventory_optimization: { min: 0.05, max: 0.25 },
  creative_optimization: { min: 0.05, max: 0.18 },
  email_marketing: { min: 0.08, max: 0.2 },
  customer_retention: { min: 0.05, max: 0.15 },
  general: { min: 0.08, max: 0.25 },
};

const MODEL_MULTIPLIER: Record<BusinessModel, number> = {
  dropshipping: 0.75,
  print_on_demand: 0.8,
  own_inventory: 1.0,
  private_label: 1.15,
  digital_products: 1.2,
  subscription: 0.92,
  hybrid: 1.0,
};

const QUALITY_META: Record<
  RecoveryQualityLabel,
  { emoji: string; description: string }
> = {
  conservative: {
    emoji: "🟢",
    description: "Highly supported by historical performance.",
  },
  moderate: {
    emoji: "🟡",
    description: "Some assumptions are required.",
  },
  aggressive: {
    emoji: "🔴",
    description: "Based on significant optimization opportunities.",
  },
};

export function inferPerformanceTier(
  ctx: Pick<
    ForecastBusinessContext,
    | "catastrophicInefficiency"
    | "monthlyProfit"
    | "blendedRoas"
    | "grossMarginPct"
    | "profitTrendPct"
    | "budgetEfficiencyScore"
  >,
): PerformanceTier {
  if (
    ctx.catastrophicInefficiency ||
    (ctx.monthlyProfit < 0 && ctx.blendedRoas != null && ctx.blendedRoas < 1)
  ) {
    return "catastrophic";
  }
  if (
    (ctx.blendedRoas != null && ctx.blendedRoas < 1.2) ||
    (ctx.budgetEfficiencyScore != null && ctx.budgetEfficiencyScore < 35)
  ) {
    return "critical";
  }
  if (
    (ctx.grossMarginPct != null && ctx.grossMarginPct < 25) ||
    (ctx.blendedRoas != null && ctx.blendedRoas < 1.8) ||
    (ctx.profitTrendPct != null && ctx.profitTrendPct < -10)
  ) {
    return "poor";
  }
  return "normal";
}

export function inferBusinessSegment(monthlyRevenue: number): BusinessSegment {
  if (monthlyRevenue >= 2_000_000) return "enterprise";
  if (monthlyRevenue >= 200_000) return "large";
  if (monthlyRevenue >= 20_000) return "medium";
  return "small";
}

export function inferOpportunityType(title?: string): RecoveryOpportunityType {
  const t = (title ?? "").toLowerCase();
  if (/reallocat|shift budget|budget shift/.test(t)) return "budget_reallocation";
  if (/pricing|price|margin/.test(t)) return "pricing_optimization";
  if (/inventory|clearance|slow.?sell|stock/.test(t)) return "inventory_optimization";
  if (/creative|fatigue|headline|ad copy/.test(t)) return "creative_optimization";
  if (/email|klaviyo|newsletter/.test(t)) return "email_marketing";
  if (/retention|churn|ltv|lifetime|vip/.test(t)) return "customer_retention";
  if (/pause|reduce budget|campaign|roas|meta|google|ads|prospect|retarget|scale/.test(t)) {
    return "campaign_optimization";
  }
  return "general";
}

function marginRecoveryFactor(grossMarginPct: number | null): number {
  if (grossMarginPct == null) return 1;
  if (grossMarginPct < 20) return 0.62;
  if (grossMarginPct < 35) return 0.82;
  if (grossMarginPct >= 55) return 1.18;
  if (grossMarginPct >= 45) return 1.08;
  return 1;
}

function opportunityMidPct(_type: RecoveryOpportunityType): number {
  return 1;
}

function estimatedWastedSpendPct(ctx: ForecastBusinessContext): number {
  const tier = ctx.performanceTier;
  if (tier === "catastrophic") return 48;
  if (tier === "critical") return 38;
  if (tier === "poor") return 32;
  if (ctx.blendedRoas != null && ctx.blendedRoas < 2) return 24;
  return 18;
}

function dynamicProfitCapPct(tier: PerformanceTier): number {
  if (tier === "catastrophic") return 0.5;
  if (tier === "critical") return 0.38;
  if (tier === "poor") return 0.32;
  return 0.24;
}

function dynamicRevenueCapPct(tier: PerformanceTier): number {
  if (tier === "catastrophic") return 0.22;
  if (tier === "critical") return 0.18;
  return 0.14;
}

function buildRange(mostLikely: number, confidencePct: number): RecoveryRange {
  const spread = confidencePct >= 80 ? 0.08 : confidencePct >= 65 ? 0.12 : 0.18;
  const delta = Math.max(15, Math.round(mostLikely * spread));
  return {
    low: Math.max(0, mostLikely - delta),
    high: mostLikely + delta,
    mostLikely,
  };
}

function inferQuality(
  confidencePct: number,
  wasCapped: boolean,
  tier: PerformanceTier,
): RecoveryQuality {
  let label: RecoveryQualityLabel;
  if (wasCapped || confidencePct < 55 || tier === "catastrophic") {
    label = "aggressive";
  } else if (confidencePct >= 78 && tier === "normal") {
    label = "conservative";
  } else if (confidencePct >= 62) {
    label = "moderate";
  } else {
    label = "aggressive";
  }
  return { label, ...QUALITY_META[label] };
}

function buildBenchmark(ctx: ForecastBusinessContext, amount: number): RecoveryBenchmark {
  const avg = SEGMENT_BENCHMARK_AVG[ctx.businessSegment];
  const ratio = avg > 0 ? (amount - avg) / avg : 0;
  const percentile = Math.max(
    12,
    Math.min(92, Math.round(50 + ratio * 28)),
  );
  const segmentLabels: Record<BusinessSegment, string> = {
    small: "Similar small Shopify stores",
    medium: "Similar mid-size Shopify stores",
    large: "Similar large Shopify stores",
    enterprise: "Similar enterprise Shopify stores",
  };
  return {
    segmentLabel: segmentLabels[ctx.businessSegment],
    averageRecovery: avg,
    yourRecovery: amount,
    percentileBetterThan: percentile,
  };
}

export function scaleConfidenceByRecoverySize(
  baseConfidence: number,
  amount: number,
  wasCapped: boolean,
  segment: BusinessSegment = "medium",
): number {
  let conf = Math.max(0, Math.min(100, baseConfidence));
  const segmentFactor =
    segment === "small" ? 1.04 : segment === "enterprise" ? 0.92 : 1;
  conf = Math.round(conf * segmentFactor);

  if (amount <= 800) conf = Math.min(conf, 92);
  else if (amount <= 2500) {
    const t = (amount - 800) / (2500 - 800);
    conf = Math.min(conf, Math.round(92 - t * 18));
  } else if (amount <= 9000) {
    const t = (amount - 2500) / (9000 - 2500);
    conf = Math.min(conf, Math.round(74 - t * 33));
  } else conf = Math.min(conf, 41);

  if (wasCapped) conf = Math.max(35, conf - 8);
  return Math.max(35, Math.min(95, conf));
}

function computeComponents(
  amount: number,
  ctx: ForecastBusinessContext,
): RecoveryComponents {
  const wastedPct = estimatedWastedSpendPct(ctx);
  const recoverableAdSpend = Math.round(
    Math.min(
      amount * 0.65,
      ctx.monthlyAdSpend * TIER_AD_RECOVERY_CAP[ctx.performanceTier],
    ),
  );
  const roasBefore = ctx.blendedRoas != null ? ctx.blendedRoas.toFixed(1) : null;
  const roasAfter =
    ctx.blendedRoas != null
      ? (ctx.blendedRoas * 1.15 + 0.25).toFixed(1)
      : null;

  const revenueImpact =
    ctx.grossMarginPct != null && ctx.grossMarginPct < 30
      ? -Math.round(amount * 0.22)
      : -Math.round(amount * 0.08);

  return {
    recoverableAdSpend,
    expectedProfitIncrease: amount,
    revenueImpact,
    roasBefore,
    roasAfter,
  };
}

export function buildRecoveryForecast(input: {
  rawAmount: number;
  baseConfidencePct: number;
  ctx: ForecastBusinessContext;
  opportunityTitle?: string;
}): RecoveryForecast {
  const { rawAmount, baseConfidencePct, ctx, opportunityTitle } = input;
  if (rawAmount <= 0) {
    const emptyComponents = computeComponents(0, ctx);
    return {
      range: { low: 0, high: 0, mostLikely: 0 },
      confidencePct: baseConfidencePct,
      quality: inferQuality(baseConfidencePct, false, ctx.performanceTier),
      components: emptyComponents,
      benchmark: buildBenchmark(ctx, 0),
      calculation: buildCalculationModel(0, ctx, opportunityTitle, 0, 0),
      amount: 0,
      originalAmount: 0,
      wasCapped: false,
      capReasons: [],
    };
  }

  const opportunityType = inferOpportunityType(opportunityTitle);
  const oppRange = OPPORTUNITY_RANGES[opportunityType];
  const tierCap = TIER_AD_RECOVERY_CAP[ctx.performanceTier];
  const modelMult = MODEL_MULTIPLIER[ctx.businessModel];
  const marginMult = marginRecoveryFactor(ctx.grossMarginPct);

  let amount = Math.round(rawAmount);
  const originalAmount = rawAmount;
  const capReasons: string[] = [];

  const adCap = ctx.monthlyAdSpend > 0
    ? Math.round(ctx.monthlyAdSpend * tierCap * (0.85 + oppRange.max * 0.5))
    : Infinity;
  if (ctx.monthlyAdSpend > 0 && amount > adCap) {
    amount = adCap;
    capReasons.push(
      `capped at ${Math.round(tierCap * 100)}% of monthly ad spend (${ctx.performanceTier} performance)`,
    );
  }

  if (ctx.monthlyProfit > 0) {
    const profitCapPct = dynamicProfitCapPct(ctx.performanceTier) * (0.7 + oppRange.max);
    const profitCap = Math.round(ctx.monthlyProfit * profitCapPct * marginMult);
    if (amount > profitCap) {
      amount = profitCap;
      capReasons.push("capped relative to monthly profit and margin profile");
    }
  }

  if (ctx.monthlyRevenue > 0) {
    const revenueCap = Math.round(
      ctx.monthlyRevenue * dynamicRevenueCapPct(ctx.performanceTier) * oppRange.max,
    );
    if (amount > revenueCap) {
      amount = revenueCap;
      capReasons.push("capped relative to monthly revenue");
    }
    if (amount > ctx.monthlyRevenue) {
      amount = revenueCap;
      capReasons.push("estimate exceeded monthly revenue");
    }
  }

  const segmentMax = Math.round(SEGMENT_MAX_RECOVERY[ctx.businessSegment] * modelMult);
  if (amount > segmentMax) {
    amount = segmentMax;
    capReasons.push(`capped for ${ctx.businessSegment} business segment`);
  }

  amount = Math.max(
    0,
    Math.round(
      amount * (0.92 + (modelMult - 1) * 0.35) * (0.78 + marginMult * 0.22),
    ),
  );
  const wasCapped = amount < originalAmount || amount < rawAmount;
  const confidencePct = scaleConfidenceByRecoverySize(
    baseConfidencePct,
    amount,
    wasCapped,
    ctx.businessSegment,
  );

  const wastedPct = estimatedWastedSpendPct(ctx);
  const recoverableSpend = Math.round(
    Math.min(amount * 0.64, ctx.monthlyAdSpend * tierCap),
  );

  return {
    range: buildRange(amount, confidencePct),
    confidencePct,
    quality: inferQuality(confidencePct, wasCapped, ctx.performanceTier),
    components: computeComponents(amount, ctx),
    benchmark: buildBenchmark(ctx, amount),
    calculation: buildCalculationModel(
      amount,
      ctx,
      opportunityTitle,
      wastedPct,
      recoverableSpend,
      opportunityType,
      tierCap,
    ),
    amount,
    originalAmount,
    wasCapped,
    capReasons,
  };
}

function buildCalculationModel(
  amount: number,
  ctx: ForecastBusinessContext,
  opportunityTitle: string | undefined,
  wastedPct: number,
  recoverableSpend: number,
  opportunityType?: RecoveryOpportunityType,
  dynamicCapPct?: number,
): RecoveryCalculationModel {
  const roasBefore = ctx.blendedRoas != null ? ctx.blendedRoas.toFixed(1) : null;
  const roasAfter =
    ctx.blendedRoas != null
      ? (ctx.blendedRoas * 1.15 + 0.25).toFixed(1)
      : null;
  const convLift = Math.min(
    12,
    Math.max(3, Math.round((amount / Math.max(ctx.monthlyRevenue, 1)) * 100)),
  );

  return {
    monthlyAdSpend: ctx.monthlyAdSpend,
    estimatedWastedSpendPct: wastedPct,
    recoverableSpend,
    roasBefore,
    roasAfter,
    conversionImprovementPct: convLift,
    historicalWindowDays: 90,
    projectedMonthlyProfitIncrease: amount,
    grossMarginPct: ctx.grossMarginPct,
    contributionMarginPct: ctx.contributionMarginPct,
    performanceTier: ctx.performanceTier,
    businessSegment: ctx.businessSegment,
    opportunityType: opportunityType ?? inferOpportunityType(opportunityTitle),
    dynamicCapPct: dynamicCapPct ?? TIER_AD_RECOVERY_CAP[ctx.performanceTier],
    businessModel: ctx.businessModel,
  };
}

export function buildForecastExplanationLines(
  forecast: RecoveryForecast,
): string[] {
  const { calculation: c, components } = forecast;
  return [
    `Monthly ad spend: $${c.monthlyAdSpend.toLocaleString()}`,
    `Estimated wasted spend: ${c.estimatedWastedSpendPct}%`,
    `Recoverable ad spend: $${components.recoverableAdSpend.toLocaleString()}/month`,
    c.roasBefore && c.roasAfter
      ? `Expected ROAS improvement: ${c.roasBefore} → ${c.roasAfter}`
      : "ROAS improvement pending more ad data",
    `Estimated conversion improvement: +${c.conversionImprovementPct}%`,
    `Historical performance window: ${c.historicalWindowDays} days`,
    c.grossMarginPct != null
      ? `Gross margin: ${c.grossMarginPct}% (profitability-weighted)`
      : "Gross margin: connect cost data for margin weighting",
    `Performance tier: ${c.performanceTier} (${Math.round(c.dynamicCapPct * 100)}% dynamic cap)`,
    `Business model: ${c.businessModel.replace(/_/g, " ")}`,
  ];
}
