import { parseRevenueImpact } from "@/lib/approvals/revenue";
import type { OpportunityCategory, RecommendationCategory } from "@/lib/types";
import type { BusinessModel, MerchantBusinessProfile } from "@/lib/business-model/types";
import type { BusinessKPIs } from "../kpis/engine";
import type { Decision, DecisionFinancialInputs } from "../decisions/types";
import type { BusinessModelConfig } from "../business-model/config";
import {
  composeBusinessRecovery,
  formulaConfidenceForModel,
  resolveBusinessModelConfig,
  resolveImpactMarginPct,
  useEfficiencyGainForAds,
} from "../business-model/config";
import {
  formulaAdvertisingSavings,
  formulaPaybackDays,
  formulaRevenueToNetProfit,
  formulaSampleSizeScore,
  roundMoney,
} from "../formulas";

export type ImpactEngineOptions = {
  historicalAccuracyPct?: number | null;
  /** Business model config, model id, or merchant profile */
  businessModel?: BusinessModelConfig | BusinessModel | MerchantBusinessProfile | null;
  inventoryAccuracy?: number | null;
  retentionHistory?: number | null;
  trafficQuality?: number | null;
};

/**
 * Layer 4 — DecisionImpact (immutable)
 * Every recommendation produces exactly one of these objects.
 * Screens read only — never recalculate.
 */
export type DecisionImpact = {
  /** Executive hero — total recoverable opportunity */
  businessRecovery: number;
  /** Alias: waste / leakage prevented */
  recoverableWaste: number | null;
  /** Revenue lift component */
  recoverableRevenue: number | null;
  revenueRecovered: number | null;
  advertisingSavings: number | null;
  advertisingSavingsLow: number | null;
  advertisingSavingsHigh: number | null;
  grossProfitImpact: number;
  netProfitImpact: number;
  cashFlowImpact: number;
  /** @deprecated Prefer netProfitImpact */
  monthlyProfitRecovery: number;
  /** @deprecated Prefer netProfitImpact */
  expectedProfit: number;
  expectedROAS: string | null;
  paybackDays: number | null;
  confidence: number;
  campaignCount: number | null;
  observationPeriodDays: number | null;
  sourceAmount: number;
  alreadyProfitLabeled: boolean;
  sourceLabel: string;
};

export const DECISION_IMPACT_COPY = {
  heroLabel: "Recoverable Profit Opportunity",
  recoverableBusinessValue: "Recoverable Business Value",
  advertisingEfficiencyGain: "Advertising Efficiency Gain",
  revenueRecovered: "Revenue Recovered",
  netProfitImprovement: "Net Profit Improvement",
  aiConfidence: "AI Confidence",
  heroTooltip:
    "Recoverable Business Value estimates the total monthly financial opportunity currently being lost. Net Profit Improvement estimates the portion expected to appear directly in operating profit after implementation.",
} as const;

export type DecisionImpactWaterfallStep = {
  label: string;
  amount: number;
  valueFormatted: string;
};

export type DecisionImpactPresentation = {
  heroLabel: string;
  heroAmount: number;
  heroValueFormatted: string;
  heroTooltip: string;
  netProfitLabel: string;
  netProfitAmount: number;
  netProfitFormatted: string;
  confidencePct: number;
  showNetProfitSecondary: boolean;
  waterfall: DecisionImpactWaterfallStep[];
  waterfallNarrative: string;
};

const MARKETING_CATEGORIES = new Set([
  "marketing",
  "advertising_efficiency",
  "product_growth",
  "marketing_attribution",
  "campaign_review",
]);

function isMarketingCategory(category?: string): boolean {
  return category != null && MARKETING_CATEGORIES.has(category);
}

function monthlyizeAmount(amount: number, label: string): number {
  const lower = label.toLowerCase();
  if (lower.includes("/week") || lower.includes("per week") || lower.includes("weekly")) {
    return roundMoney(amount * 4.33);
  }
  if (lower.includes("/day") || lower.includes("per day")) {
    return roundMoney(amount * 30);
  }
  if (/\b7\s*days?\b/i.test(label) || /\bnext\s+week\b/i.test(label)) {
    return roundMoney(amount * 4.33);
  }
  return amount;
}

function extractDollarAmounts(label: string): number[] {
  return [...label.matchAll(/\$[\d,]+(?:\.\d+)?/g)].map((m) =>
    Number(m[0].replace(/[$,]/g, "")),
  );
}

export function extractExplicitProfitAmount(label: string): number | null {
  const lower = label.toLowerCase();
  if (!lower.includes("profit")) return null;
  const nearProfit =
    label.match(
      /\$([\d,]+(?:\.\d+)?)\s*(?:\/\s*mo(?:nth)?)?\s*(?:net\s+)?(?:profit|in profit)/i,
    ) ??
    label.match(
      /~\s*\$([\d,]+(?:\.\d+)?)\s*(?:\/\s*mo(?:nth)?)?\s*(?:net\s+)?(?:profit|in profit)/i,
    ) ??
    label.match(/profit[^\d$]{0,24}\$([\d,]+(?:\.\d+)?)/i);
  if (nearProfit?.[1]) {
    return Number(nearProfit[1].replace(/,/g, "")) || null;
  }
  return null;
}

function isSavingsContext(label: string): boolean {
  const lower = label.toLowerCase();
  return (
    lower.includes("saving") ||
    lower.includes("cost savings") ||
    lower.includes("ad efficiency") ||
    lower.includes("business recovery") ||
    lower.includes("at risk")
  );
}

export function detectAdvertisingSavingsRange(
  label: string,
  amounts: number[],
): { low: number; high: number; mid: number } | null {
  if (!isSavingsContext(label) || amounts.length === 0) return null;
  const explicitProfit = extractExplicitProfitAmount(label);
  const savingsAmounts =
    explicitProfit != null ? amounts.filter((a) => a !== explicitProfit) : amounts;
  if (savingsAmounts.length === 0) return null;
  if (savingsAmounts.length >= 2) {
    const low = Math.min(savingsAmounts[0], savingsAmounts[1]);
    const high = Math.max(savingsAmounts[0], savingsAmounts[1]);
    return {
      low: monthlyizeAmount(low, label),
      high: monthlyizeAmount(high, label),
      mid: monthlyizeAmount(Math.round((low + high) / 2), label),
    };
  }
  const single = monthlyizeAmount(savingsAmounts[0], label);
  return { low: single, high: single, mid: single };
}

export function recommendationCategoryToOpportunity(
  category: RecommendationCategory | string | undefined,
): OpportunityCategory {
  switch (category) {
    case "low_inventory":
      return "inventory";
    case "slow_selling":
      return "pricing";
    case "bundle_opportunity":
      return "bundle";
    case "homepage_merchandising":
      return "merchandising";
    case "promotion_opportunity":
      return "customer_retention";
    case "campaign_review":
    case "marketing":
    case "advertising_efficiency":
      return "marketing";
    default:
      return "inventory";
  }
}

function resolveConfidence(
  inputs: DecisionFinancialInputs,
  kpis: BusinessKPIs,
  config: BusinessModelConfig,
  opts?: ImpactEngineOptions,
): number {
  const fromScore =
    inputs.confidenceScore != null
      ? inputs.confidenceScore <= 1
        ? Math.round(inputs.confidenceScore * 100)
        : Math.round(inputs.confidenceScore)
      : null;

  const historical =
    opts?.historicalAccuracyPct != null ? opts.historicalAccuracyPct / 100 : null;

  const computed = formulaConfidenceForModel(
    {
      dataQuality: historical ?? opts?.trafficQuality ?? null,
      sampleSizeScore: formulaSampleSizeScore(kpis.orders),
      predictionStability:
        inputs.confidenceScore != null && inputs.confidenceScore <= 1
          ? inputs.confidenceScore
          : null,
      historicalAccuracy: historical,
      inventoryAccuracy: opts?.inventoryAccuracy ?? null,
      retentionHistory: opts?.retentionHistory ?? null,
      trafficQuality: opts?.trafficQuality ?? null,
    },
    config,
  );

  return fromScore != null && fromScore > 0 ? fromScore : computed;
}

function buildImpactFromStructured(
  inputs: DecisionFinancialInputs,
  kpis: BusinessKPIs,
  config: BusinessModelConfig,
  opts?: ImpactEngineOptions,
): DecisionImpact {
  const category = inputs.category;
  const marketing = isMarketingCategory(category);
  const marginPct = resolveImpactMarginPct(kpis.netMarginPct, config);
  const useEfficiency = useEfficiencyGainForAds(marketing, config);

  let advertisingSavings =
    inputs.advertisingSavingsMonthly ??
    (inputs.currentAdSpendMonthly != null && inputs.expectedAdSpendMonthly != null
      ? formulaAdvertisingSavings(
          inputs.currentAdSpendMonthly,
          inputs.expectedAdSpendMonthly,
        )
      : null);

  const avoidedWaste =
    inputs.avoidedWasteMonthly ?? resolveAvoidedWasteLow(inputs) ?? 0;
  const recoveredRevenue = inputs.recoveredRevenueMonthly ?? 0;
  const marginImprovement = inputs.marginImprovementMonthly ?? 0;

  let netProfit =
    inputs.netProfitMonthly != null && inputs.netProfitMonthly > 0
      ? roundMoney(inputs.netProfitMonthly)
      : 0;

  if (netProfit <= 0 && advertisingSavings != null && advertisingSavings > 0) {
    netProfit = formulaRevenueToNetProfit(advertisingSavings, {
      isMarketingEfficiency: useEfficiency,
      storeNetMarginPct: marginPct,
    });
  } else if (netProfit <= 0 && recoveredRevenue > 0) {
    netProfit = formulaRevenueToNetProfit(recoveredRevenue, {
      isMarketingEfficiency: useEfficiency && marketing,
      storeNetMarginPct: marginPct,
    });
  }

  const businessRecovery = composeBusinessRecovery(
    {
      avoidedWaste,
      advertisingSavings: advertisingSavings ?? 0,
      recoveredRevenue,
      marginImprovement,
    },
    config,
  );

  const grossProfitImpact = advertisingSavings ?? recoveredRevenue ?? netProfit;
  const cashFlowImpact = advertisingSavings ?? netProfit;

  return finalizeImpact({
    businessRecovery,
    recoverableWaste: avoidedWaste > 0 ? avoidedWaste : null,
    recoverableRevenue: recoveredRevenue > 0 ? recoveredRevenue : null,
    revenueRecovered: recoveredRevenue > 0 ? recoveredRevenue : null,
    advertisingSavings,
    advertisingSavingsLow: inputs.avoidedWasteMonthly ?? null,
    advertisingSavingsHigh: inputs.avoidedWasteHighMonthly ?? null,
    grossProfitImpact,
    netProfitImpact: netProfit,
    cashFlowImpact,
    expectedROAS: inputs.expectedROAS ?? null,
    paybackDays: formulaPaybackDays(inputs.implementationCost ?? 0, netProfit),
    confidence: resolveConfidence(inputs, kpis, config, opts),
    campaignCount: inputs.campaignCount ?? null,
    observationPeriodDays: inputs.observationPeriodDays ?? null,
    sourceAmount: grossProfitImpact,
    alreadyProfitLabeled: inputs.netProfitMonthly != null,
    sourceLabel: inputs.expectedImpactLabel ?? "",
  });
}

function resolveAvoidedWasteLow(inputs: DecisionFinancialInputs): number | null {
  return inputs.avoidedWasteMonthly ?? inputs.advertisingSavingsMonthly ?? null;
}

function buildImpactFromLabel(
  inputs: DecisionFinancialInputs,
  kpis: BusinessKPIs,
  config: BusinessModelConfig,
  opts?: ImpactEngineOptions,
): DecisionImpact {
  const label = inputs.expectedImpactLabel?.trim() || "";
  const amounts = extractDollarAmounts(label);
  const explicitProfit = extractExplicitProfitAmount(label);
  const savingsRange = detectAdvertisingSavingsRange(label, amounts);
  const category = inputs.category;
  const marketing = isMarketingCategory(category);
  const marginPct = resolveImpactMarginPct(kpis.netMarginPct, config);
  const useEfficiency = useEfficiencyGainForAds(marketing, config);

  let advertisingSavings: number | null = savingsRange?.mid ?? null;
  let advertisingSavingsLowVal: number | null = savingsRange?.low ?? null;
  let advertisingSavingsHigh: number | null = savingsRange?.high ?? null;
  let revenueRecovered: number | null = null;
  let netProfitImpact = 0;
  let alreadyProfitLabeled = false;
  let sourceAmount = 0;
  let grossProfitImpact = 0;
  let recoverableWaste: number | null = null;

  if (explicitProfit != null && explicitProfit > 0) {
    alreadyProfitLabeled = true;
    sourceAmount = monthlyizeAmount(explicitProfit, label);
    netProfitImpact = sourceAmount;
    grossProfitImpact = advertisingSavings ?? sourceAmount;
    recoverableWaste = advertisingSavingsLowVal;
  } else if (savingsRange != null) {
    advertisingSavings = savingsRange.mid;
    advertisingSavingsLowVal = savingsRange.low;
    advertisingSavingsHigh = savingsRange.high;
    sourceAmount = savingsRange.mid;
    grossProfitImpact = savingsRange.mid;
    recoverableWaste = savingsRange.low;
    netProfitImpact = formulaRevenueToNetProfit(savingsRange.mid, {
      isMarketingEfficiency: useEfficiency,
      storeNetMarginPct: marginPct,
    });
  } else {
    const parsed = parseRevenueImpact(label);
    sourceAmount = parsed;
    revenueRecovered = parsed > 0 ? parsed : null;
    grossProfitImpact = parsed;
    netProfitImpact = formulaRevenueToNetProfit(parsed, {
      isMarketingEfficiency: useEfficiency,
      storeNetMarginPct: marginPct,
    });
  }

  const avoidedWaste = advertisingSavingsLowVal ?? advertisingSavings ?? 0;
  const businessRecovery = composeBusinessRecovery(
    {
      avoidedWaste,
      advertisingSavings: advertisingSavings ?? 0,
      recoveredRevenue: revenueRecovered ?? 0,
      marginImprovement: 0,
    },
    config,
  );

  return finalizeImpact({
    businessRecovery: Math.max(businessRecovery, netProfitImpact),
    recoverableWaste,
    recoverableRevenue: revenueRecovered,
    revenueRecovered,
    advertisingSavings,
    advertisingSavingsLow: advertisingSavingsLowVal,
    advertisingSavingsHigh,
    grossProfitImpact,
    netProfitImpact,
    cashFlowImpact: advertisingSavings ?? netProfitImpact,
    expectedROAS: inputs.expectedROAS ?? null,
    paybackDays: formulaPaybackDays(inputs.implementationCost ?? 0, netProfitImpact),
    confidence: resolveConfidence(inputs, kpis, config, opts),
    campaignCount: inputs.campaignCount ?? null,
    observationPeriodDays: inputs.observationPeriodDays ?? null,
    sourceAmount,
    alreadyProfitLabeled,
    sourceLabel: label,
  });
}

function finalizeImpact(partial: Omit<DecisionImpact, "monthlyProfitRecovery" | "expectedProfit">): DecisionImpact {
  return {
    ...partial,
    monthlyProfitRecovery: partial.netProfitImpact,
    expectedProfit: partial.netProfitImpact,
  };
}

function hasStructuredFinancialInputs(inputs: DecisionFinancialInputs): boolean {
  return (
    (inputs.avoidedWasteMonthly != null && inputs.avoidedWasteMonthly > 0) ||
    (inputs.advertisingSavingsMonthly != null && inputs.advertisingSavingsMonthly > 0) ||
    (inputs.netProfitMonthly != null && inputs.netProfitMonthly > 0) ||
    (inputs.recoveredRevenueMonthly != null && inputs.recoveredRevenueMonthly > 0) ||
    (inputs.marginImprovementMonthly != null && inputs.marginImprovementMonthly > 0) ||
    (inputs.currentAdSpendMonthly != null && inputs.expectedAdSpendMonthly != null)
  );
}

/**
 * Layer 4 entry:
 *   calculateDecisionImpact(decision, kpis)
 *   calculateDecisionImpact(decision, kpis, businessModelConfig)
 *   calculateDecisionImpact(decision, kpis, { businessModel, historicalAccuracyPct, ... })
 */
export function calculateDecisionImpact(
  decision: Decision,
  kpis: BusinessKPIs,
  businessModelOrOpts?:
    | BusinessModelConfig
    | BusinessModel
    | MerchantBusinessProfile
    | ImpactEngineOptions
    | null,
): DecisionImpact {
  const resolvedOpts = normalizeImpactOpts(businessModelOrOpts);
  const config = resolveBusinessModelConfig(resolvedOpts.businessModel ?? null);

  const inputs: DecisionFinancialInputs = {
    ...decision.financialInputs,
    confidenceScore: decision.confidenceScore,
  };

  if (hasStructuredFinancialInputs(inputs)) {
    return buildImpactFromStructured(inputs, kpis, config, resolvedOpts);
  }
  return buildImpactFromLabel(inputs, kpis, config, resolvedOpts);
}

function normalizeImpactOpts(
  arg?:
    | BusinessModelConfig
    | BusinessModel
    | MerchantBusinessProfile
    | ImpactEngineOptions
    | null,
): ImpactEngineOptions {
  if (arg == null) return {};
  if (typeof arg === "string") return { businessModel: arg };
  if ("recoveryComposition" in arg) return { businessModel: arg };
  if ("businessModelSource" in arg) return { businessModel: arg };
  if (
    "historicalAccuracyPct" in arg ||
    "inventoryAccuracy" in arg ||
    "retentionHistory" in arg ||
    "trafficQuality" in arg ||
    ("businessModel" in arg && !("storeId" in arg) && !("recoveryComposition" in arg))
  ) {
    return arg as ImpactEngineOptions;
  }
  return { businessModel: arg as MerchantBusinessProfile };
}

/** Legacy adapter — label + category (used until all producers emit Decision objects) */
export function calculateDecisionImpactFromInputs(
  input: {
    expectedImpactLabel: string;
    category?: RecommendationCategory | OpportunityCategory | string;
    confidenceScore?: number;
    netMarginPct?: number;
    campaignCount?: number | null;
    supportingMetrics?: { label: string; value: string }[];
    observationPeriodDays?: number | null;
    implementationCost?: number | null;
    historicalAccuracyPct?: number | null;
  },
  kpis?: BusinessKPIs,
  businessModel?: BusinessModelConfig | BusinessModel | MerchantBusinessProfile | null,
): DecisionImpact {
  const marginKpis: BusinessKPIs =
    kpis ??
    ({
      netMarginPct: input.netMarginPct ?? null,
      orders: 0,
    } as BusinessKPIs);

  const config = resolveBusinessModelConfig(businessModel ?? null);
  const opts: ImpactEngineOptions = {
    historicalAccuracyPct: input.historicalAccuracyPct ?? null,
    businessModel: config,
  };

  const roas =
    input.supportingMetrics?.find((m) => /roas/i.test(m.label))?.value ?? null;

  const financialInputs: DecisionFinancialInputs = {
    expectedImpactLabel: input.expectedImpactLabel,
    category: input.category,
    confidenceScore: input.confidenceScore,
    campaignCount: input.campaignCount,
    observationPeriodDays: input.observationPeriodDays,
    implementationCost: input.implementationCost,
    expectedROAS: roas,
  };

  if (hasStructuredFinancialInputs(financialInputs)) {
    return buildImpactFromStructured(financialInputs, marginKpis, config, opts);
  }
  return buildImpactFromLabel(financialInputs, marginKpis, config, opts);
}

export function mergeDecisionImpacts(parts: DecisionImpact[]): DecisionImpact {
  if (parts.length === 0) {
    return calculateDecisionImpactFromInputs({ expectedImpactLabel: "" });
  }
  if (parts.length === 1) return parts[0];

  let businessRecovery = 0;
  let recoverableWaste = 0;
  let hasWaste = false;
  let recoverableRevenue = 0;
  let hasRev = false;
  let revenueRecovered = 0;
  let hasRevenueRecovered = false;
  let advertisingSavings = 0;
  let hasAdSavings = false;
  let advertisingSavingsLow = 0;
  let hasAdLow = false;
  let advertisingSavingsHigh = 0;
  let hasAdHigh = false;
  let grossProfitImpact = 0;
  let netProfitImpact = 0;
  let cashFlowImpact = 0;
  let confidenceWeighted = 0;

  for (const p of parts) {
    businessRecovery += p.businessRecovery;
    grossProfitImpact += p.grossProfitImpact;
    netProfitImpact += p.netProfitImpact;
    cashFlowImpact += p.cashFlowImpact;
    confidenceWeighted += p.confidence;
    if (p.recoverableWaste != null) {
      recoverableWaste += p.recoverableWaste;
      hasWaste = true;
    }
    if (p.recoverableRevenue != null) {
      recoverableRevenue += p.recoverableRevenue;
      hasRev = true;
    }
    if (p.revenueRecovered != null) {
      revenueRecovered += p.revenueRecovered;
      hasRevenueRecovered = true;
    }
    if (p.advertisingSavings != null) {
      advertisingSavings += p.advertisingSavings;
      hasAdSavings = true;
    }
    if (p.advertisingSavingsLow != null) {
      advertisingSavingsLow += p.advertisingSavingsLow;
      hasAdLow = true;
    }
    if (p.advertisingSavingsHigh != null) {
      advertisingSavingsHigh += p.advertisingSavingsHigh;
      hasAdHigh = true;
    }
  }

  const base = parts[0];
  return finalizeImpact({
    ...base,
    businessRecovery,
    recoverableWaste: hasWaste ? recoverableWaste : null,
    recoverableRevenue: hasRev ? recoverableRevenue : null,
    revenueRecovered: hasRevenueRecovered ? revenueRecovered : null,
    advertisingSavings: hasAdSavings ? advertisingSavings : null,
    advertisingSavingsLow: hasAdLow ? advertisingSavingsLow : null,
    advertisingSavingsHigh: hasAdHigh ? advertisingSavingsHigh : null,
    grossProfitImpact,
    netProfitImpact,
    cashFlowImpact,
    confidence: Math.round(confidenceWeighted / parts.length),
    sourceAmount: parts.reduce((s, p) => s + p.sourceAmount, 0),
  });
}

function fmtMonthly(amount: number, opts?: { prefixPlus?: boolean }): string {
  const rounded = Math.round(amount);
  if (rounded <= 0) return "$0";
  const prefix = opts?.prefixPlus !== false ? "+" : "";
  return `${prefix}$${rounded.toLocaleString()}`;
}

function buildWaterfallNarrative(impact: DecisionImpact): string {
  const recovery = impact.businessRecovery;
  const profit = impact.netProfitImpact;
  if (recovery > 0 && profit > 0 && recovery !== profit) {
    if (impact.advertisingSavings != null && impact.advertisingSavings > 0) {
      return `Most of the recoverable value comes from eliminating wasted ad spend and improving campaign efficiency. The direct increase in monthly net profit is estimated at ${fmtMonthly(profit)}, while preventing approximately ${fmtMonthly(recovery, { prefixPlus: false })}/month in ongoing business leakage.`;
    }
    return `This decision addresses approximately ${fmtMonthly(recovery, { prefixPlus: false })}/month in recoverable business value. After implementation, an estimated ${fmtMonthly(profit)} is expected to flow through to monthly net profit.`;
  }
  if (profit > 0) {
    return `StorePilot estimates ${fmtMonthly(profit)} in monthly net profit improvement if you approve this decision today.`;
  }
  if (recovery > 0) {
    return `Approximately ${fmtMonthly(recovery, { prefixPlus: false })}/month in recoverable business value is available if you act on this recommendation.`;
  }
  return "";
}

export function buildDecisionImpactPresentation(
  impact: DecisionImpact,
): DecisionImpactPresentation {
  const waterfall: DecisionImpactWaterfallStep[] = [];

  if (impact.businessRecovery > 0) {
    waterfall.push({
      label: DECISION_IMPACT_COPY.recoverableBusinessValue,
      amount: impact.businessRecovery,
      valueFormatted: fmtMonthly(impact.businessRecovery, { prefixPlus: false }),
    });
  }

  if (impact.advertisingSavings != null && impact.advertisingSavings > 0) {
    waterfall.push({
      label: DECISION_IMPACT_COPY.advertisingEfficiencyGain,
      amount: impact.advertisingSavings,
      valueFormatted: fmtMonthly(impact.advertisingSavings),
    });
  } else if (impact.revenueRecovered != null && impact.revenueRecovered > 0) {
    waterfall.push({
      label: DECISION_IMPACT_COPY.revenueRecovered,
      amount: impact.revenueRecovered,
      valueFormatted: fmtMonthly(impact.revenueRecovered),
    });
  }

  if (impact.netProfitImpact > 0) {
    waterfall.push({
      label: DECISION_IMPACT_COPY.netProfitImprovement,
      amount: impact.netProfitImpact,
      valueFormatted: `${fmtMonthly(impact.netProfitImpact)}/month`,
    });
  }

  const showNetProfitSecondary =
    impact.netProfitImpact > 0 && impact.netProfitImpact !== impact.businessRecovery;

  return {
    heroLabel: DECISION_IMPACT_COPY.heroLabel,
    heroAmount: impact.businessRecovery,
    heroValueFormatted: fmtMonthly(impact.businessRecovery),
    heroTooltip: DECISION_IMPACT_COPY.heroTooltip,
    netProfitLabel: DECISION_IMPACT_COPY.netProfitImprovement,
    netProfitAmount: impact.netProfitImpact,
    netProfitFormatted: `${fmtMonthly(impact.netProfitImpact)}/month`,
    confidencePct: impact.confidence,
    showNetProfitSecondary,
    waterfall,
    waterfallNarrative: buildWaterfallNarrative(impact),
  };
}

export function formatDecisionMonthlyImpact(amount: number): string {
  return fmtMonthly(amount);
}

export function decisionImpactWaterfall(impact: DecisionImpact): {
  label: string;
  amount: number;
}[] {
  return buildDecisionImpactPresentation(impact).waterfall.map((s) => ({
    label: s.label,
    amount: s.amount,
  }));
}
