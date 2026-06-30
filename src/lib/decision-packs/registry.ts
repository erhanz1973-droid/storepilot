import type { BusinessModel } from "@/lib/business-model/types";
import type { RecommendationAnalyzer } from "@/lib/recommendations/analyzer-types";
import type { AnalyzerOutput, OpportunityCategory, RecommendationCategory } from "@/lib/types";
import type { EnrichedDecisionItem } from "@/lib/decisions/engine/types";
import type { DecisionItem } from "@/lib/decisions/center";
import type { SimulationType } from "@/lib/ai/what-if-types";
import {
  DIGITAL_PRODUCTS_PACK,
  DROPSHIPPING_PACK,
  HYBRID_PACK,
  OWN_INVENTORY_PACK,
  PRINT_ON_DEMAND_PACK,
  PRIVATE_LABEL_PACK,
  SUBSCRIPTION_PACK,
} from "./packs";
import type {
  BusinessModelPromptContext,
  DecisionPack,
  DecisionPackContext,
  DecisionTopic,
} from "./types";

const PACKS: Record<BusinessModel, DecisionPack> = {
  own_inventory: OWN_INVENTORY_PACK,
  dropshipping: DROPSHIPPING_PACK,
  private_label: PRIVATE_LABEL_PACK,
  print_on_demand: PRINT_ON_DEMAND_PACK,
  digital_products: DIGITAL_PRODUCTS_PACK,
  subscription: SUBSCRIPTION_PACK,
  hybrid: HYBRID_PACK,
};

const TOPIC_LABELS: Record<DecisionTopic, string> = {
  dead_inventory: "Dead Inventory",
  inventory_clearance: "Inventory Clearance",
  reorder_suggestion: "Reorder Suggestions",
  warehouse_optimization: "Warehouse Optimization",
  inventory_aging: "Inventory Aging",
  overstock_detection: "Overstock Detection",
  bundles: "Bundles",
  cash_flow: "Cash Flow",
  winning_products: "Winning Products",
  losing_products: "Losing Products",
  product_scaling: "Product Scaling",
  creative_fatigue: "Creative Fatigue",
  high_cpa: "High CPA Alerts",
  roas_optimization: "ROAS Optimization",
  landing_page: "Landing Page Optimization",
  product_kill_list: "Product Kill List",
  price_optimization: "Price Optimization",
  marketing_efficiency: "Marketing Efficiency",
  campaign_scaling: "Campaign Scaling",
  campaign_review: "Campaign Review",
  best_selling_designs: "Best Selling Designs",
  variant_optimization: "Variant Optimization",
  seasonal_opportunities: "Seasonal Opportunities",
  creative_performance: "Creative Performance",
  product_expansion: "Product Expansion",
  funnel_optimization: "Funnel Optimization",
  checkout_conversion: "Checkout Conversion",
  upsells: "Upsells",
  email_conversion: "Email Conversion",
  subscription_growth: "Subscription Growth",
  customer_ltv: "Customer Lifetime Value",
  churn_risk: "Churn Risk",
  renewal_rate: "Renewal Rate",
  customer_retention: "Customer Retention",
  trial_conversion: "Trial Conversion",
  upsell_opportunities: "Upsell Opportunities",
  homepage_merchandising: "Homepage Merchandising",
  promotions: "Promotions",
};

const RECOMMENDATION_TOPIC_MAP: Record<RecommendationCategory, DecisionTopic[]> = {
  low_inventory: ["reorder_suggestion"],
  slow_selling: ["dead_inventory", "inventory_clearance", "inventory_aging", "losing_products"],
  bundle_opportunity: ["bundles"],
  homepage_merchandising: ["homepage_merchandising"],
  promotion_opportunity: ["promotions", "price_optimization"],
  campaign_review: ["campaign_review", "campaign_scaling", "roas_optimization", "high_cpa"],
};

const OPPORTUNITY_TOPIC_MAP: Record<OpportunityCategory, DecisionTopic[]> = {
  inventory: ["dead_inventory", "inventory_clearance", "reorder_suggestion", "overstock_detection"],
  pricing: ["price_optimization", "promotions"],
  bundle: ["bundles"],
  merchandising: ["homepage_merchandising", "product_expansion"],
  marketing: ["marketing_efficiency", "campaign_scaling", "creative_fatigue"],
  advertising_efficiency: ["roas_optimization", "high_cpa", "campaign_review"],
  product_growth: ["winning_products", "product_scaling", "losing_products"],
  marketing_attribution: ["marketing_efficiency", "roas_optimization"],
  customer_retention: ["churn_risk", "customer_retention", "renewal_rate"],
};

function mergeHybridPack(
  pack: DecisionPack,
  weights?: Partial<Record<BusinessModel, number>>,
): DecisionPack {
  const normalized = Object.entries(weights ?? { own_inventory: 0.5, dropshipping: 0.5 })
    .filter(([, w]) => (w ?? 0) > 0)
    .sort(([, a], [, b]) => (b ?? 0) - (a ?? 0));

  const constituents = normalized.length
    ? normalized.map(([model]) => PACKS[model as BusinessModel] ?? OWN_INVENTORY_PACK)
    : [OWN_INVENTORY_PACK, DROPSHIPPING_PACK];

  const union = <T>(selector: (p: DecisionPack) => T[]): T[] =>
    [...new Set(constituents.flatMap(selector))];

  return {
    ...pack,
    enabledTopics: union((p) => p.enabledTopics),
    disabledTopics: union((p) => p.disabledTopics).filter(
      (topic) => !union((p) => p.enabledTopics).includes(topic as DecisionTopic),
    ) as DecisionTopic[],
    enabledRecommendationCategories: union((p) => p.enabledRecommendationCategories),
    disabledRecommendationCategories: union((p) => p.disabledRecommendationCategories).filter(
      (c) => !union((p) => p.enabledRecommendationCategories).includes(c as RecommendationCategory),
    ) as RecommendationCategory[],
    enabledOpportunityCategories: union((p) => p.enabledOpportunityCategories),
    disabledOpportunityCategories: union((p) => p.disabledOpportunityCategories).filter(
      (c) => !union((p) => p.enabledOpportunityCategories).includes(c as OpportunityCategory),
    ) as OpportunityCategory[],
    enabledSimulationTypes: union((p) => p.enabledSimulationTypes),
    disabledSimulationTypes: union((p) => p.disabledSimulationTypes).filter(
      (s) => !union((p) => p.enabledSimulationTypes).includes(s as SimulationType),
    ) as SimulationType[],
    healthMetricIds: union((p) => p.healthMetricIds),
    dashboardWidgets: union((p) => p.dashboardWidgets),
    enableInventoryStrategies: constituents.some((p) => p.enableInventoryStrategies),
  };
}

export function getDecisionPack(
  businessModel: BusinessModel,
  hybridWeights?: Partial<Record<BusinessModel, number>>,
): DecisionPack {
  const base = PACKS[businessModel] ?? OWN_INVENTORY_PACK;
  if (businessModel !== "hybrid") return base;
  return mergeHybridPack(base, hybridWeights);
}

export function buildDecisionPackContext(input: {
  businessModel: BusinessModel;
  hybridWeights?: Partial<Record<BusinessModel, number>>;
}): DecisionPackContext {
  const pack = getDecisionPack(input.businessModel, input.hybridWeights);
  const enabledTopics = new Set(pack.enabledTopics);
  const disabledTopics = new Set(pack.disabledTopics);
  const prompt = buildBusinessModelPromptContext(input.businessModel, pack);

  return {
    businessModel: input.businessModel,
    pack,
    enabledTopics,
    disabledTopics,
    promptContext: prompt.narrative,
  };
}

export function buildBusinessModelPromptContext(
  businessModel: BusinessModel,
  pack?: DecisionPack,
  hybridWeights?: Partial<Record<BusinessModel, number>>,
): BusinessModelPromptContext {
  const resolved = pack ?? getDecisionPack(businessModel, hybridWeights);
  const enabledDecisions = resolved.enabledTopics.map((t) => TOPIC_LABELS[t]);
  const disabledDecisions = resolved.disabledTopics.map((t) => TOPIC_LABELS[t]);

  const narrative = [
    `Merchant Business Model: ${resolved.label}`,
    `Decision Pack: ${resolved.label}`,
    `Enabled Decisions: ${enabledDecisions.join(", ") || "—"}`,
    `Disabled Decisions: ${disabledDecisions.join(", ") || "—"}`,
  ].join("\n");

  return {
    businessModel,
    packLabel: resolved.label,
    enabledDecisions,
    disabledDecisions,
    narrative,
  };
}

function inferTopicsFromText(text: string): DecisionTopic[] {
  const lower = text.toLowerCase();
  const topics: DecisionTopic[] = [];
  if (lower.includes("inventory") || lower.includes("stock") || lower.includes("warehouse")) {
    topics.push("dead_inventory", "inventory_aging", "reorder_suggestion");
  }
  if (lower.includes("clearance") || lower.includes("slow")) {
    topics.push("inventory_clearance", "dead_inventory");
  }
  if (lower.includes("scale") || lower.includes("winner") || lower.includes("roas")) {
    topics.push("winning_products", "product_scaling", "roas_optimization");
  }
  if (lower.includes("creative") || lower.includes("fatigue") || lower.includes("ad ")) {
    topics.push("creative_fatigue", "marketing_efficiency");
  }
  if (lower.includes("churn") || lower.includes("retention")) {
    topics.push("churn_risk", "customer_retention");
  }
  if (lower.includes("funnel") || lower.includes("checkout")) {
    topics.push("funnel_optimization", "checkout_conversion");
  }
  return topics;
}

function decisionTopics(item: DecisionItem): DecisionTopic[] {
  const topics = new Set<DecisionTopic>();
  const summary = `${item.summary} ${item.why}`.toLowerCase();

  if (item.source === "recommendation" && item.recommendationId) {
    // category attached via summary keywords when not on DecisionItem
  }

  for (const topic of inferTopicsFromText(summary)) topics.add(topic);
  if (summary.includes("bundle")) topics.add("bundles");
  if (summary.includes("campaign")) topics.add("campaign_review");
  if (summary.includes("homepage") || summary.includes("merchandis")) {
    topics.add("homepage_merchandising");
  }
  if (summary.includes("promotion") || summary.includes("discount")) {
    topics.add("promotions");
    topics.add("price_optimization");
  }

  return [...topics];
}

export function recommendationAllowedByPack(
  category: RecommendationCategory,
  pack: DecisionPack,
): boolean {
  if (pack.disabledRecommendationCategories.includes(category)) return false;
  if (pack.enabledRecommendationCategories.length === 0) return true;
  return pack.enabledRecommendationCategories.includes(category);
}

export function analyzerAllowedByPack(
  analyzer: RecommendationAnalyzer,
  pack: DecisionPack,
): boolean {
  return recommendationAllowedByPack(analyzer.category, pack);
}

export function filterAnalyzerOutputs(
  outputs: AnalyzerOutput[],
  pack: DecisionPack,
): AnalyzerOutput[] {
  return outputs.filter((o) => recommendationAllowedByPack(o.category, pack));
}

export function filterAnalyzers(
  analyzers: RecommendationAnalyzer[],
  pack: DecisionPack,
): RecommendationAnalyzer[] {
  return analyzers.filter((a) => analyzerAllowedByPack(a, pack));
}

export function decisionAllowedByPack(item: DecisionItem, pack: DecisionPack): boolean {
  const summary = `${item.summary} ${item.why}`.toLowerCase();

  if (pack.disabledTopics.some((topic) => summaryIncludesTopic(summary, topic))) {
    return false;
  }

  const topics = decisionTopics(item);
  if (topics.length === 0) return true;

  const hasEnabled = topics.some((t) => pack.enabledTopics.includes(t));
  const hasDisabledOnly = topics.every((t) => pack.disabledTopics.includes(t));
  if (hasDisabledOnly) return false;
  if (!hasEnabled && topics.some((t) => pack.disabledTopics.includes(t))) return false;

  if (
    !pack.enableInventoryStrategies &&
    (summary.includes("inventory") ||
      summary.includes("clearance") ||
      summary.includes("reorder") ||
      summary.includes("warehouse") ||
      summary.includes("overstock"))
  ) {
    return false;
  }

  return true;
}

function summaryIncludesTopic(summary: string, topic: DecisionTopic): boolean {
  const keywords: Partial<Record<DecisionTopic, string[]>> = {
    dead_inventory: ["dead inventory", "slow-selling", "slow selling", "aged stock"],
    inventory_clearance: ["clearance", "clear stock"],
    reorder_suggestion: ["low inventory", "reorder", "restock", "stock out"],
    warehouse_optimization: ["warehouse"],
    inventory_aging: ["aging", "aged inventory"],
    overstock_detection: ["overstock"],
    bundles: ["bundle"],
    cash_flow: ["cash flow", "cash recovery"],
    winning_products: ["winner", "winning product", "hero product"],
    losing_products: ["losing product", "underperforming product"],
    product_scaling: ["scale", "scaling"],
    creative_fatigue: ["creative fatigue", "ad fatigue"],
    high_cpa: ["high cpa", "cpa spike"],
    roas_optimization: ["roas"],
    landing_page: ["landing page"],
    product_kill_list: ["kill list", "pause product"],
    price_optimization: ["price", "pricing"],
    marketing_efficiency: ["marketing efficiency", "ad spend"],
    campaign_scaling: ["scale campaign", "increase budget"],
    campaign_review: ["campaign"],
    churn_risk: ["churn"],
    customer_retention: ["retention"],
    funnel_optimization: ["funnel"],
    checkout_conversion: ["checkout"],
  };
  const list = keywords[topic] ?? [TOPIC_LABELS[topic].toLowerCase()];
  return list.some((k) => summary.includes(k));
}

export function filterDecisionsByPack<T extends DecisionItem>(
  decisions: T[],
  pack: DecisionPack,
): T[] {
  return decisions.filter((d) => decisionAllowedByPack(d, pack));
}

export function filterEnrichedDecisionsByPack(
  decisions: EnrichedDecisionItem[],
  pack: DecisionPack,
): EnrichedDecisionItem[] {
  return filterDecisionsByPack(decisions, pack);
}

export function simulationAllowedByPack(type: SimulationType, pack: DecisionPack): boolean {
  if (pack.disabledSimulationTypes.includes(type)) return false;
  if (pack.enabledSimulationTypes.length === 0) return true;
  return pack.enabledSimulationTypes.includes(type);
}

export function filterSimulationsByPack(
  types: SimulationType[],
  pack: DecisionPack,
): SimulationType[] {
  return types.filter((t) => simulationAllowedByPack(t, pack));
}

export function topicsForRecommendation(category: RecommendationCategory): DecisionTopic[] {
  return RECOMMENDATION_TOPIC_MAP[category] ?? [];
}

export function topicsForOpportunity(category: OpportunityCategory): DecisionTopic[] {
  return OPPORTUNITY_TOPIC_MAP[category] ?? [];
}

export { PACKS, TOPIC_LABELS };
