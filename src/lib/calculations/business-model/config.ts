import type { BusinessModel, MerchantBusinessProfile } from "@/lib/business-model/types";
import { normalizeBusinessModel } from "@/lib/business-model/types";

/**
 * Layer 2.5 — Business Model Configuration
 *
 * The Formula Library stays universal. This layer chooses which formulas apply,
 * how they are weighted, and which KPIs the presentation layer emphasizes.
 */

export type RecoveryStrategy =
  | "margin_plus_waste"
  | "ads_plus_supplier"
  | "recurring_value"
  | "ads_plus_high_margin_revenue"
  | "hybrid_blend";

export type ProfitFormulaId = "standard_net" | "high_cogs_passthrough" | "near_zero_cogs" | "recurring_contribution";

export type MarginFormulaId = "gross_then_net" | "contribution_after_supplier" | "ltv_cac" | "digital_gross";

export type InventoryRuleId = "tracked_days_cover" | "untracked" | "dropship_no_inventory" | "digital_no_inventory" | "mixed";

export type PaybackRuleId = "monthly_net_gain" | "cac_payback" | "ltv_payback" | "ad_efficiency_days";

/** Normalized 0–1 weights for confidence factors (must sum conceptually; normalized at use). */
export type ConfidenceWeights = {
  dataQuality: number;
  sampleSize: number;
  predictionStability: number;
  historicalAccuracy: number;
  /** Model-specific extras (e.g. inventory accuracy, retention, traffic quality) */
  inventoryAccuracy: number;
  retentionHistory: number;
  trafficQuality: number;
};

export type KpiId =
  | "revenue"
  | "grossProfit"
  | "netProfit"
  | "grossMarginPct"
  | "netMarginPct"
  | "contributionMargin"
  | "adSpend"
  | "blendedRoas"
  | "mer"
  | "cac"
  | "cpa"
  | "aov"
  | "conversionRatePct"
  | "inventoryDays"
  | "inventoryTurnover"
  | "mrr"
  | "churn"
  | "ltv"
  | "cacPayback"
  | "sellThroughRate";

export type OptimizationPriority =
  | "protect_margin"
  | "reduce_ad_waste"
  | "grow_ltv"
  | "reduce_churn"
  | "improve_roas"
  | "clear_inventory"
  | "scale_winners"
  | "improve_conversion";

/**
 * Composition of Business Recovery from canonical components.
 * Weights are relative (normalized at compose time). Zero weight = excluded.
 */
export type RecoveryComposition = {
  avoidedWaste: number;
  advertisingSavings: number;
  recoveredRevenue: number;
  marginImprovement: number;
  /** Dropshipping: portion of avoided spend × supplier cost rate */
  supplierCostReduction: number;
  /** Subscription: future MRR / reduced-churn value */
  recurringValue: number;
};

export type BusinessModelConfig = {
  businessModel: BusinessModel;
  label: string;
  profitFormula: ProfitFormulaId;
  marginFormula: MarginFormulaId;
  recoveryStrategy: RecoveryStrategy;
  recoveryComposition: RecoveryComposition;
  /**
   * Default net margin rate when store margin unknown.
   * Digital ≈ high; dropshipping ≈ lower contribution after supplier.
   */
  defaultNetMarginRate: number;
  /**
   * When converting marketing/ad savings → net profit, use efficiency factor
   * (true) or store/default margin (false).
   */
  treatAdSavingsAsEfficiencyGain: boolean;
  /** Fraction of advertising savings assumed to reduce supplier COGS (dropship). */
  supplierCostRate: number;
  /** Multiplier on recovered revenue for subscription LTV-aware recovery. */
  recurringRevenueMultiplier: number;
  inventoryRules: InventoryRuleId;
  paybackRules: PaybackRuleId;
  confidenceWeights: ConfidenceWeights;
  /** KPIs the dashboard should emphasize (engine may still compute all). */
  primaryKpis: KpiId[];
  optimizationPriorities: OptimizationPriority[];
  /** Short description for Calculation Bible / UI */
  recoveryDefinition: string;
};

const BASE_CONFIDENCE: ConfidenceWeights = {
  dataQuality: 0.25,
  sampleSize: 0.25,
  predictionStability: 0.25,
  historicalAccuracy: 0.25,
  inventoryAccuracy: 0,
  retentionHistory: 0,
  trafficQuality: 0,
};

export const BUSINESS_MODEL_CONFIGS: Record<BusinessModel, BusinessModelConfig> = {
  own_inventory: {
    businessModel: "own_inventory",
    label: "Own Inventory",
    profitFormula: "standard_net",
    marginFormula: "gross_then_net",
    recoveryStrategy: "margin_plus_waste",
    recoveryComposition: {
      avoidedWaste: 0.45,
      advertisingSavings: 0.25,
      recoveredRevenue: 0.15,
      marginImprovement: 0.15,
      supplierCostReduction: 0,
      recurringValue: 0,
    },
    defaultNetMarginRate: 0.38,
    treatAdSavingsAsEfficiencyGain: true,
    supplierCostRate: 0,
    recurringRevenueMultiplier: 1,
    inventoryRules: "tracked_days_cover",
    paybackRules: "monthly_net_gain",
    confidenceWeights: {
      ...BASE_CONFIDENCE,
      inventoryAccuracy: 0.2,
      dataQuality: 0.2,
      sampleSize: 0.2,
      predictionStability: 0.2,
      historicalAccuracy: 0.2,
    },
    primaryKpis: [
      "netProfit",
      "grossMarginPct",
      "inventoryDays",
      "blendedRoas",
      "aov",
      "sellThroughRate",
    ],
    optimizationPriorities: ["protect_margin", "reduce_ad_waste", "clear_inventory", "scale_winners"],
    recoveryDefinition:
      "Business Recovery = Recovered Margin + Advertising Savings + Avoided Waste (owned stock at risk).",
  },

  dropshipping: {
    businessModel: "dropshipping",
    label: "Dropshipping",
    profitFormula: "high_cogs_passthrough",
    marginFormula: "contribution_after_supplier",
    recoveryStrategy: "ads_plus_supplier",
    recoveryComposition: {
      avoidedWaste: 0.2,
      advertisingSavings: 0.45,
      recoveredRevenue: 0.1,
      marginImprovement: 0.05,
      supplierCostReduction: 0.2,
      recurringValue: 0,
    },
    defaultNetMarginRate: 0.22,
    treatAdSavingsAsEfficiencyGain: true,
    supplierCostRate: 0.72,
    recurringRevenueMultiplier: 1,
    inventoryRules: "dropship_no_inventory",
    paybackRules: "ad_efficiency_days",
    confidenceWeights: {
      ...BASE_CONFIDENCE,
      trafficQuality: 0.25,
      dataQuality: 0.2,
      sampleSize: 0.2,
      predictionStability: 0.2,
      historicalAccuracy: 0.15,
      inventoryAccuracy: 0,
    },
    primaryKpis: ["blendedRoas", "mer", "cpa", "contributionMargin", "aov", "conversionRatePct"],
    optimizationPriorities: ["reduce_ad_waste", "improve_roas", "improve_conversion", "scale_winners"],
    recoveryDefinition:
      "Business Recovery = Advertising Savings + Supplier Cost Reduction (no owned inventory).",
  },

  private_label: {
    businessModel: "private_label",
    label: "Private Label",
    profitFormula: "standard_net",
    marginFormula: "gross_then_net",
    recoveryStrategy: "margin_plus_waste",
    recoveryComposition: {
      avoidedWaste: 0.4,
      advertisingSavings: 0.3,
      recoveredRevenue: 0.15,
      marginImprovement: 0.15,
      supplierCostReduction: 0,
      recurringValue: 0,
    },
    defaultNetMarginRate: 0.42,
    treatAdSavingsAsEfficiencyGain: true,
    supplierCostRate: 0.35,
    recurringRevenueMultiplier: 1,
    inventoryRules: "tracked_days_cover",
    paybackRules: "monthly_net_gain",
    confidenceWeights: {
      ...BASE_CONFIDENCE,
      inventoryAccuracy: 0.15,
      trafficQuality: 0.1,
      dataQuality: 0.2,
      sampleSize: 0.2,
      predictionStability: 0.2,
      historicalAccuracy: 0.15,
    },
    primaryKpis: ["grossMarginPct", "netProfit", "blendedRoas", "inventoryDays", "aov"],
    optimizationPriorities: ["protect_margin", "reduce_ad_waste", "scale_winners"],
    recoveryDefinition:
      "Business Recovery = Brand margin recovery + Advertising Savings + Avoided Waste.",
  },

  print_on_demand: {
    businessModel: "print_on_demand",
    label: "Print on Demand",
    profitFormula: "high_cogs_passthrough",
    marginFormula: "contribution_after_supplier",
    recoveryStrategy: "ads_plus_supplier",
    recoveryComposition: {
      avoidedWaste: 0.15,
      advertisingSavings: 0.5,
      recoveredRevenue: 0.15,
      marginImprovement: 0.05,
      supplierCostReduction: 0.15,
      recurringValue: 0,
    },
    defaultNetMarginRate: 0.28,
    treatAdSavingsAsEfficiencyGain: true,
    supplierCostRate: 0.55,
    recurringRevenueMultiplier: 1,
    inventoryRules: "dropship_no_inventory",
    paybackRules: "ad_efficiency_days",
    confidenceWeights: {
      ...BASE_CONFIDENCE,
      trafficQuality: 0.3,
      sampleSize: 0.2,
      dataQuality: 0.2,
      predictionStability: 0.15,
      historicalAccuracy: 0.15,
    },
    primaryKpis: ["blendedRoas", "contributionMargin", "cpa", "conversionRatePct", "aov"],
    optimizationPriorities: ["reduce_ad_waste", "improve_roas", "improve_conversion"],
    recoveryDefinition:
      "Business Recovery = Advertising Savings + Print-partner cost reduction on wasted traffic.",
  },

  digital_products: {
    businessModel: "digital_products",
    label: "Digital Products",
    profitFormula: "near_zero_cogs",
    marginFormula: "digital_gross",
    recoveryStrategy: "ads_plus_high_margin_revenue",
    recoveryComposition: {
      avoidedWaste: 0.1,
      advertisingSavings: 0.45,
      recoveredRevenue: 0.4,
      marginImprovement: 0.05,
      supplierCostReduction: 0,
      recurringValue: 0,
    },
    defaultNetMarginRate: 0.75,
    treatAdSavingsAsEfficiencyGain: false,
    supplierCostRate: 0,
    recurringRevenueMultiplier: 1,
    inventoryRules: "digital_no_inventory",
    paybackRules: "ad_efficiency_days",
    confidenceWeights: {
      ...BASE_CONFIDENCE,
      trafficQuality: 0.35,
      sampleSize: 0.2,
      dataQuality: 0.15,
      predictionStability: 0.15,
      historicalAccuracy: 0.15,
      inventoryAccuracy: 0,
    },
    primaryKpis: ["blendedRoas", "conversionRatePct", "aov", "netMarginPct", "cpa", "mer"],
    optimizationPriorities: ["improve_roas", "improve_conversion", "reduce_ad_waste", "scale_winners"],
    recoveryDefinition:
      "Business Recovery = Advertising Savings + High-Margin Revenue (COGS ≈ 0).",
  },

  subscription: {
    businessModel: "subscription",
    label: "Subscription",
    profitFormula: "recurring_contribution",
    marginFormula: "ltv_cac",
    recoveryStrategy: "recurring_value",
    recoveryComposition: {
      avoidedWaste: 0.1,
      advertisingSavings: 0.2,
      recoveredRevenue: 0.15,
      marginImprovement: 0.05,
      supplierCostReduction: 0,
      recurringValue: 0.5,
    },
    defaultNetMarginRate: 0.45,
    treatAdSavingsAsEfficiencyGain: false,
    supplierCostRate: 0,
    recurringRevenueMultiplier: 3,
    inventoryRules: "untracked",
    paybackRules: "cac_payback",
    confidenceWeights: {
      ...BASE_CONFIDENCE,
      retentionHistory: 0.35,
      historicalAccuracy: 0.2,
      dataQuality: 0.15,
      sampleSize: 0.15,
      predictionStability: 0.15,
      inventoryAccuracy: 0,
      trafficQuality: 0,
    },
    primaryKpis: ["mrr", "churn", "ltv", "cacPayback", "cac", "netProfit"],
    optimizationPriorities: ["reduce_churn", "grow_ltv", "improve_roas", "reduce_ad_waste"],
    recoveryDefinition:
      "Business Recovery = Reduced Churn + Future MRR (recurring value) + Advertising Efficiency.",
  },

  hybrid: {
    businessModel: "hybrid",
    label: "Hybrid",
    profitFormula: "standard_net",
    marginFormula: "gross_then_net",
    recoveryStrategy: "hybrid_blend",
    recoveryComposition: {
      avoidedWaste: 0.25,
      advertisingSavings: 0.3,
      recoveredRevenue: 0.2,
      marginImprovement: 0.1,
      supplierCostReduction: 0.05,
      recurringValue: 0.1,
    },
    defaultNetMarginRate: 0.35,
    treatAdSavingsAsEfficiencyGain: true,
    supplierCostRate: 0.4,
    recurringRevenueMultiplier: 1.5,
    inventoryRules: "mixed",
    paybackRules: "monthly_net_gain",
    confidenceWeights: {
      ...BASE_CONFIDENCE,
      inventoryAccuracy: 0.1,
      retentionHistory: 0.1,
      trafficQuality: 0.1,
      dataQuality: 0.2,
      sampleSize: 0.2,
      predictionStability: 0.15,
      historicalAccuracy: 0.15,
    },
    primaryKpis: [
      "netProfit",
      "blendedRoas",
      "grossMarginPct",
      "contributionMargin",
      "aov",
      "cac",
    ],
    optimizationPriorities: ["reduce_ad_waste", "protect_margin", "scale_winners", "grow_ltv"],
    recoveryDefinition:
      "Business Recovery = Blended weights across inventory, ads, supplier, and recurring components.",
  },
};

export function resolveBusinessModelConfig(
  modelOrProfile?: BusinessModel | MerchantBusinessProfile | BusinessModelConfig | null,
): BusinessModelConfig {
  if (!modelOrProfile) {
    return BUSINESS_MODEL_CONFIGS.own_inventory;
  }
  if (typeof modelOrProfile === "string") {
    return BUSINESS_MODEL_CONFIGS[normalizeBusinessModel(modelOrProfile)];
  }
  if ("recoveryComposition" in modelOrProfile) {
    return modelOrProfile;
  }
  const model = normalizeBusinessModel(modelOrProfile.businessModel);
  const base = BUSINESS_MODEL_CONFIGS[model];
  if (modelOrProfile.typicalMarginPct != null && modelOrProfile.typicalMarginPct > 0) {
    return {
      ...base,
      defaultNetMarginRate: modelOrProfile.typicalMarginPct / 100,
    };
  }
  return base;
}

export type RecoveryComponents = {
  avoidedWaste: number;
  advertisingSavings: number;
  recoveredRevenue: number;
  marginImprovement: number;
};

/**
 * Compose Business Recovery using universal formula components + model strategy.
 * Does not invent new dollars — selects and weights available inputs.
 */
export function composeBusinessRecovery(
  components: RecoveryComponents,
  config: BusinessModelConfig,
): number {
  const {
    avoidedWaste,
    advertisingSavings,
    recoveredRevenue,
    marginImprovement,
  } = components;

  const supplierReduction = Math.round(advertisingSavings * config.supplierCostRate);
  const recurringValue = Math.round(
    recoveredRevenue * config.recurringRevenueMultiplier,
  );

  let recovery = 0;

  switch (config.recoveryStrategy) {
    case "margin_plus_waste":
      // Own inventory / private label: CEO hero = waste at risk (low bound) when known;
      // otherwise advertising savings + recovered margin.
      recovery =
        avoidedWaste > 0
          ? avoidedWaste + marginImprovement
          : advertisingSavings + marginImprovement + Math.round(recoveredRevenue * 0.38);
      break;

    case "ads_plus_supplier":
      // Dropship / POD: ad savings + supplier cost reduction
      recovery = advertisingSavings + supplierReduction;
      if (recovery <= 0) recovery = avoidedWaste;
      break;

    case "recurring_value":
      // Subscription: churn/MRR value dominates; ads secondary
      recovery = Math.max(
        recurringValue + Math.round(advertisingSavings * 0.35),
        avoidedWaste,
        recoveredRevenue * config.recurringRevenueMultiplier,
      );
      break;

    case "ads_plus_high_margin_revenue":
      // Digital: ad savings + near-full recovered revenue
      recovery = advertisingSavings + recoveredRevenue + Math.round(avoidedWaste * 0.25);
      if (recovery <= 0) recovery = Math.max(avoidedWaste, advertisingSavings);
      break;

    case "hybrid_blend":
    default: {
      const c = config.recoveryComposition;
      const weightSum =
        c.avoidedWaste + c.advertisingSavings + c.recoveredRevenue + c.marginImprovement;
      const core =
        weightSum > 0
          ? (avoidedWaste * c.avoidedWaste +
              advertisingSavings * c.advertisingSavings +
              recoveredRevenue * c.recoveredRevenue +
              marginImprovement * c.marginImprovement) /
            weightSum
          : 0;
      recovery = Math.round(
        core +
          advertisingSavings * config.supplierCostRate * c.supplierCostReduction +
          recoveredRevenue * config.recurringRevenueMultiplier * c.recurringValue,
      );
      break;
    }
  }

  // Never below net-visible single component floor for CEO trust
  const floor = Math.max(avoidedWaste, Math.round(advertisingSavings * 0.5), recoveredRevenue);
  return Math.max(0, Math.round(recovery), floor > 0 ? floor : 0);
}

/**
 * Model-aware margin for converting revenue/savings → net profit.
 */
export function resolveImpactMarginPct(
  kpisNetMarginPct: number | null | undefined,
  config: BusinessModelConfig,
): number {
  if (kpisNetMarginPct != null && kpisNetMarginPct > 0) {
    return kpisNetMarginPct;
  }
  return config.defaultNetMarginRate * 100;
}

/**
 * Whether ad savings should use marketing efficiency factor for this model.
 */
export function useEfficiencyGainForAds(
  categoryIsMarketing: boolean,
  config: BusinessModelConfig,
): boolean {
  if (!categoryIsMarketing) return false;
  return config.treatAdSavingsAsEfficiencyGain;
}

export type ConfidenceFactorInputs = {
  dataQuality?: number | null;
  sampleSizeScore?: number | null;
  predictionStability?: number | null;
  historicalAccuracy?: number | null;
  inventoryAccuracy?: number | null;
  retentionHistory?: number | null;
  trafficQuality?: number | null;
};

/**
 * Weighted confidence 0–100 using business-model confidenceWeights.
 * Factors are 0–1; weights from config; missing factors skipped.
 */
export function formulaConfidenceForModel(
  factors: ConfidenceFactorInputs,
  config: BusinessModelConfig,
): number {
  const w = config.confidenceWeights;
  const pairs: { value: number; weight: number }[] = [];

  const push = (value: number | null | undefined, weight: number) => {
    if (value == null || !Number.isFinite(value) || weight <= 0) return;
    const v = Math.min(1, Math.max(0, value > 1 ? value / 100 : value));
    if (v <= 0) return;
    pairs.push({ value: v, weight });
  };

  push(factors.dataQuality, w.dataQuality);
  push(factors.sampleSizeScore, w.sampleSize);
  push(factors.predictionStability, w.predictionStability);
  push(factors.historicalAccuracy, w.historicalAccuracy);
  push(factors.inventoryAccuracy, w.inventoryAccuracy);
  push(factors.retentionHistory, w.retentionHistory);
  push(factors.trafficQuality, w.trafficQuality);

  if (pairs.length === 0) return 0;

  const weightSum = pairs.reduce((s, p) => s + p.weight, 0);
  if (weightSum <= 0) return 0;

  // Weighted geometric mean in log space for stability
  const logSum = pairs.reduce(
    (s, p) => s + p.weight * Math.log(Math.max(p.value, 1e-6)),
    0,
  );
  const geo = Math.exp(logSum / weightSum);
  return Math.round(geo * 100);
}

/** Presentation helper — which KPI ids a dashboard should highlight. */
export function selectPrimaryKpis(config: BusinessModelConfig): KpiId[] {
  return [...config.primaryKpis];
}

export function isInventoryRelevant(config: BusinessModelConfig): boolean {
  return (
    config.inventoryRules === "tracked_days_cover" || config.inventoryRules === "mixed"
  );
}
