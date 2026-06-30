import type { SimulationType } from "@/lib/ai/what-if-types";
import type {
  BusinessModel,
  DashboardWidgetId,
  BusinessModelHealthMetric,
} from "@/lib/business-model/types";
import type { OpportunityCategory, RecommendationCategory } from "@/lib/types";

export type DecisionTopic =
  | "dead_inventory"
  | "inventory_clearance"
  | "reorder_suggestion"
  | "warehouse_optimization"
  | "inventory_aging"
  | "overstock_detection"
  | "bundles"
  | "cash_flow"
  | "winning_products"
  | "losing_products"
  | "product_scaling"
  | "creative_fatigue"
  | "high_cpa"
  | "roas_optimization"
  | "landing_page"
  | "product_kill_list"
  | "price_optimization"
  | "marketing_efficiency"
  | "campaign_scaling"
  | "campaign_review"
  | "best_selling_designs"
  | "variant_optimization"
  | "seasonal_opportunities"
  | "creative_performance"
  | "product_expansion"
  | "funnel_optimization"
  | "checkout_conversion"
  | "upsells"
  | "email_conversion"
  | "subscription_growth"
  | "customer_ltv"
  | "churn_risk"
  | "renewal_rate"
  | "customer_retention"
  | "trial_conversion"
  | "upsell_opportunities"
  | "homepage_merchandising"
  | "promotions";

export type DecisionPack = {
  id: BusinessModel;
  label: string;
  description: string;
  enabledTopics: DecisionTopic[];
  disabledTopics: DecisionTopic[];
  enabledRecommendationCategories: RecommendationCategory[];
  disabledRecommendationCategories: RecommendationCategory[];
  enabledOpportunityCategories: OpportunityCategory[];
  disabledOpportunityCategories: OpportunityCategory[];
  enabledSimulationTypes: SimulationType[];
  disabledSimulationTypes: SimulationType[];
  healthMetricIds: string[];
  dashboardWidgets: DashboardWidgetId[];
  enableInventoryStrategies: boolean;
};

export type DecisionPackContext = {
  businessModel: BusinessModel;
  pack: DecisionPack;
  enabledTopics: Set<DecisionTopic>;
  disabledTopics: Set<DecisionTopic>;
  promptContext: string;
};

export type BusinessModelPromptContext = {
  businessModel: BusinessModel;
  packLabel: string;
  enabledDecisions: string[];
  disabledDecisions: string[];
  narrative: string;
};
