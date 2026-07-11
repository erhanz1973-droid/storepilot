import type { StoreSnapshot } from "@/lib/connectors/types";
import type { ProfitDashboard } from "@/lib/profit/types";
import type { BusinessModel, MerchantBusinessProfile } from "@/lib/business-model/types";
import {
  buildForecastExplanationLines,
  buildRecoveryForecast,
  inferBusinessSegment,
  inferPerformanceTier,
  scaleConfidenceByRecoverySize as scaleForecastConfidence,
  type RecoveryBenchmark,
  type RecoveryCalculationModel,
  type RecoveryComponents,
  type RecoveryForecast,
  type RecoveryQuality,
  type RecoveryRange,
} from "./recovery-forecast-engine";

export type {
  RecoveryBenchmark,
  RecoveryCalculationModel,
  RecoveryComponents,
  RecoveryForecast,
  RecoveryQuality,
  RecoveryRange,
} from "./recovery-forecast-engine";

export type BusinessScaleContext = {
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
  performanceTier: import("./recovery-forecast-engine").PerformanceTier;
  businessSegment: import("./recovery-forecast-engine").BusinessSegment;
  businessModel: BusinessModel;
  profitTrendPct: number | null;
  budgetEfficiencyScore: number | null;
};

export type RecoveryExplanationFactor = {
  label: string;
};

export type RecoveryExplanation = {
  headline: string;
  basedOn: string[];
  disclaimer: string;
  wasCapped: boolean;
  capNote?: string;
  range?: RecoveryRange;
  confidencePct?: number;
  quality?: RecoveryQuality;
  components?: RecoveryComponents;
  benchmark?: RecoveryBenchmark;
  calculation?: RecoveryCalculationModel;
};

export type ConstrainedRecovery = {
  amount: number;
  originalAmount: number;
  wasCapped: boolean;
  capReasons: string[];
  confidencePct: number;
  explanation: RecoveryExplanation;
  forecast: RecoveryForecast;
};

export function buildBusinessScaleContext(
  profitDashboard: ProfitDashboard | null,
  snapshot: StoreSnapshot,
  options?: {
    businessProfile?: MerchantBusinessProfile | null;
    profitTrendPct?: number | null;
  },
): BusinessScaleContext {
  const primary = profitDashboard?.primary;
  const monthlyRevenue =
    primary?.revenue ?? snapshot.salesTrends?.last30Days.revenue ?? 0;
  const monthlyProfit = primary?.netProfit ?? 0;

  const metaWeeklySpend = snapshot.campaigns.reduce((s, c) => s + c.spend7d, 0);
  const googleWeeklySpend = (snapshot.googleAdsSnapshot?.campaigns ?? []).reduce(
    (s, c) => s + c.spend7d,
    0,
  );
  const campaignMonthlyAdSpend = Math.round((metaWeeklySpend + googleWeeklySpend) * 4.33);
  const monthlyAdSpend = Math.max(primary?.adSpend ?? 0, campaignMonthlyAdSpend);

  const metaRoas =
    metaWeeklySpend > 0
      ? snapshot.campaigns.reduce((s, c) => s + c.revenue7d, 0) / metaWeeklySpend
      : null;
  const googleRoas =
    googleWeeklySpend > 0
      ? (snapshot.googleAdsSnapshot?.campaigns ?? []).reduce((s, c) => s + c.revenue7d, 0) /
        googleWeeklySpend
      : null;

  const blendedRoas =
    profitDashboard?.blendedRoas?.blendedRoas30d ??
    (metaRoas != null && googleRoas != null
      ? (metaRoas + googleRoas) / 2
      : (metaRoas ?? googleRoas));

  const grossMarginPct =
    primary && primary.revenue > 0
      ? Math.round((primary.grossProfit / primary.revenue) * 1000) / 10
      : options?.businessProfile?.typicalMarginPct ?? null;

  const cogsPct =
    primary && primary.revenue > 0
      ? Math.round((primary.cogs / primary.revenue) * 1000) / 10
      : null;

  const shippingCostPct =
    primary && primary.revenue > 0
      ? Math.round((primary.shippingCost / primary.revenue) * 1000) / 10
      : null;

  const contributionMarginPct =
    primary && primary.revenue > 0
      ? Math.round(
          ((primary.grossProfit - (primary.adSpend ?? 0)) / primary.revenue) * 1000,
        ) / 10
      : grossMarginPct;

  const conversionRatePct =
    snapshot.ga4Snapshot?.ecommerceConversionRatePct ??
    (primary && primary.orders > 0 && primary.revenue > 0
      ? Math.round(
          (primary.orders / (primary.revenue / (snapshot.storeMetrics.aov30d || 80))) * 1000,
        ) / 10
      : null);

  const catastrophicInefficiency =
    monthlyProfit < 0 && monthlyAdSpend > monthlyRevenue * 0.2;

  const businessModel =
    options?.businessProfile?.businessModel ?? "own_inventory";

  const budgetEfficiencyScore =
    blendedRoas != null
      ? Math.max(0, Math.min(100, Math.round(blendedRoas * 40)))
      : null;

  const base: Omit<BusinessScaleContext, "performanceTier" | "businessSegment"> = {
    monthlyRevenue: Math.round(monthlyRevenue),
    monthlyProfit: Math.round(monthlyProfit),
    monthlyAdSpend: Math.round(monthlyAdSpend),
    blendedRoas: blendedRoas != null ? Math.round(blendedRoas * 100) / 100 : null,
    conversionRatePct,
    grossMarginPct,
    contributionMarginPct,
    cogsPct,
    shippingCostPct,
    catastrophicInefficiency,
    businessModel,
    profitTrendPct: options?.profitTrendPct ?? null,
    budgetEfficiencyScore,
  };

  const performanceTier = inferPerformanceTier(base);
  const businessSegment = inferBusinessSegment(base.monthlyRevenue);

  return { ...base, performanceTier, businessSegment };
}

/** @deprecated Use buildRecoveryForecast via constrainRecoveryEstimate */
export function maxRecoverableRecovery(ctx: BusinessScaleContext): number {
  const tierCap =
    ctx.performanceTier === "catastrophic"
      ? 0.7
      : ctx.performanceTier === "critical"
        ? 0.5
        : ctx.performanceTier === "poor"
          ? 0.4
          : 0.3;
  const caps: number[] = [];
  if (ctx.monthlyAdSpend > 0) caps.push(Math.round(ctx.monthlyAdSpend * tierCap));
  if (ctx.monthlyProfit > 0) {
    const profitPct =
      ctx.performanceTier === "catastrophic"
        ? 0.5
        : ctx.performanceTier === "critical"
          ? 0.38
          : 0.24;
    caps.push(Math.round(ctx.monthlyProfit * profitPct));
  }
  if (ctx.monthlyRevenue > 0) {
    caps.push(Math.round(ctx.monthlyRevenue * 0.14));
  }
  const segmentMax = {
    small: 1_500,
    medium: 15_000,
    large: 80_000,
    enterprise: 500_000,
  }[ctx.businessSegment];
  caps.push(segmentMax);
  return Math.max(0, Math.min(...caps));
}

/** @deprecated Use forecast.confidencePct */
export function scaleConfidenceByRecoverySize(
  baseConfidence: number,
  amount: number,
  wasCapped: boolean,
): number {
  return scaleForecastConfidence(baseConfidence, amount, wasCapped, "medium");
}

function buildRecoveryExplanation(
  forecast: RecoveryForecast,
  factors?: RecoveryExplanationFactor[],
): RecoveryExplanation {
  const basedOn =
    factors && factors.length > 0
      ? factors.map((f) => f.label)
      : buildForecastExplanationLines(forecast);

  const explanation: RecoveryExplanation = {
    headline:
      forecast.amount > 0
        ? `+$${forecast.range.low.toLocaleString()}–$${forecast.range.high.toLocaleString()}/month`
        : "—",
    basedOn,
    disclaimer: "This estimate assumes no changes in product pricing or inventory.",
    wasCapped: forecast.wasCapped,
    range: forecast.range,
    confidencePct: forecast.confidencePct,
    quality: forecast.quality,
    components: forecast.components,
    benchmark: forecast.benchmark,
    calculation: forecast.calculation,
  };

  if (forecast.wasCapped && forecast.capReasons.length > 0) {
    explanation.capNote = forecast.capReasons.join("; ");
  }
  return explanation;
}

export function constrainRecoveryEstimate(
  rawAmount: number,
  baseConfidencePct: number,
  ctx: BusinessScaleContext,
  factors?: RecoveryExplanationFactor[],
  opportunityTitle?: string,
): ConstrainedRecovery {
  const forecast = buildRecoveryForecast({
    rawAmount,
    baseConfidencePct,
    ctx,
    opportunityTitle,
  });

  return {
    amount: forecast.amount,
    originalAmount: forecast.originalAmount,
    wasCapped: forecast.wasCapped,
    capReasons: forecast.capReasons,
    confidencePct: forecast.confidencePct,
    explanation: buildRecoveryExplanation(forecast, factors),
    forecast,
  };
}

export function constrainRecoveryTotal(
  rawTotal: number,
  baseConfidencePct: number,
  ctx: BusinessScaleContext,
): ConstrainedRecovery {
  return constrainRecoveryEstimate(rawTotal, baseConfidencePct, ctx);
}

export function constrainPlatformRecovery(
  rawAmount: number,
  platformMonthlySpend: number,
  baseConfidencePct: number,
  ctx: BusinessScaleContext,
): ConstrainedRecovery {
  const tierCap =
    ctx.performanceTier === "catastrophic"
      ? 0.7
      : ctx.performanceTier === "critical"
        ? 0.5
        : ctx.performanceTier === "poor"
          ? 0.4
          : 0.3;
  const platformCap = Math.round(platformMonthlySpend * tierCap);
  const preCapped = platformCap > 0 ? Math.min(rawAmount, platformCap) : rawAmount;

  const factors: RecoveryExplanationFactor[] = [];
  if (platformMonthlySpend > 0) {
    factors.push({
      label: `Platform monthly spend: $${platformMonthlySpend.toLocaleString()}`,
    });
    factors.push({
      label: `Dynamic recoverable cap: $${platformCap.toLocaleString()} (${Math.round(tierCap * 100)}% — ${ctx.performanceTier} performance)`,
    });
  }

  return constrainRecoveryEstimate(
    preCapped,
    baseConfidencePct,
    ctx,
    factors,
    "campaign optimization",
  );
}

export { buildForecastExplanationLines, buildRecoveryForecast };
