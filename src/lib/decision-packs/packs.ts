import type { DecisionPack, DecisionTopic } from "./types";

const INVENTORY_TOPICS: DecisionTopic[] = [
  "dead_inventory",
  "inventory_clearance",
  "reorder_suggestion",
  "warehouse_optimization",
  "inventory_aging",
  "overstock_detection",
  "bundles",
  "cash_flow",
];

const MARKETING_TOPICS: DecisionTopic[] = [
  "winning_products",
  "losing_products",
  "product_scaling",
  "creative_fatigue",
  "high_cpa",
  "roas_optimization",
  "landing_page",
  "product_kill_list",
  "price_optimization",
  "marketing_efficiency",
  "campaign_scaling",
  "campaign_review",
  "homepage_merchandising",
  "promotions",
];

const POD_TOPICS: DecisionTopic[] = [
  "best_selling_designs",
  "variant_optimization",
  "seasonal_opportunities",
  "creative_performance",
  "product_expansion",
  ...MARKETING_TOPICS,
];

const DIGITAL_TOPICS: DecisionTopic[] = [
  "funnel_optimization",
  "checkout_conversion",
  "upsells",
  "email_conversion",
  "subscription_growth",
  "customer_ltv",
  "homepage_merchandising",
  "campaign_review",
  "roas_optimization",
];

const SUBSCRIPTION_TOPICS: DecisionTopic[] = [
  "churn_risk",
  "renewal_rate",
  "customer_retention",
  "customer_ltv",
  "trial_conversion",
  "upsell_opportunities",
  "email_conversion",
  "campaign_review",
];

export const OWN_INVENTORY_PACK: DecisionPack = {
  id: "own_inventory",
  label: "Own Inventory",
  description: "Warehouse-based retail with stock, clearance, and cash-flow focus.",
  enabledTopics: [...INVENTORY_TOPICS, "homepage_merchandising", "promotions", "campaign_review"],
  disabledTopics: [],
  enabledRecommendationCategories: [
    "low_inventory",
    "slow_selling",
    "bundle_opportunity",
    "homepage_merchandising",
    "promotion_opportunity",
    "campaign_review",
  ],
  disabledRecommendationCategories: [],
  enabledOpportunityCategories: [
    "inventory",
    "pricing",
    "bundle",
    "merchandising",
    "marketing",
    "advertising_efficiency",
    "product_growth",
  ],
  disabledOpportunityCategories: [],
  enabledSimulationTypes: [
    "apply_discount",
    "restock_inventory",
    "create_bundle",
    "increase_price",
    "decrease_price",
    "add_homepage_feature",
    "pause_campaign",
    "increase_meta_budget",
  ],
  disabledSimulationTypes: [],
  healthMetricIds: [
    "inventory_health",
    "inventory_aging",
    "clearance_opportunities",
    "warehouse_value",
    "cash_flow",
    "overstock_risk",
  ],
  dashboardWidgets: [
    "inventory_health",
    "inventory_aging",
    "clearance_opportunities",
    "warehouse_value",
    "campaign_health",
  ],
  enableInventoryStrategies: true,
};

export const DROPSHIPPING_PACK: DecisionPack = {
  id: "dropshipping",
  label: "Dropshipping",
  description: "Supplier-fulfilled catalog — marketing and product winners, not warehouse ops.",
  enabledTopics: MARKETING_TOPICS,
  disabledTopics: INVENTORY_TOPICS,
  enabledRecommendationCategories: [
    "homepage_merchandising",
    "promotion_opportunity",
    "campaign_review",
    "bundle_opportunity",
  ],
  disabledRecommendationCategories: ["low_inventory", "slow_selling"],
  enabledOpportunityCategories: [
    "pricing",
    "marketing",
    "advertising_efficiency",
    "product_growth",
    "merchandising",
  ],
  disabledOpportunityCategories: ["inventory", "bundle"],
  enabledSimulationTypes: [
    "increase_meta_budget",
    "increase_google_budget",
    "pause_campaign",
    "apply_discount",
    "decrease_price",
    "add_homepage_feature",
  ],
  disabledSimulationTypes: ["restock_inventory", "create_bundle"],
  healthMetricIds: [
    "winning_products",
    "creative_fatigue",
    "roas",
    "scaling_opportunities",
    "store_conversion",
    "refund_rate",
  ],
  dashboardWidgets: [
    "winning_products",
    "scaling_opportunities",
    "creative_fatigue",
    "campaign_health",
    "top_roas_products",
  ],
  enableInventoryStrategies: false,
};

export const PRIVATE_LABEL_PACK: DecisionPack = {
  ...OWN_INVENTORY_PACK,
  id: "private_label",
  label: "Private Label",
  description: "Branded catalog with inventory discipline and margin expansion.",
  enabledTopics: [
    ...INVENTORY_TOPICS,
    "price_optimization",
    "product_expansion",
    "homepage_merchandising",
    "campaign_review",
  ],
  healthMetricIds: [
    "inventory_health",
    "margin_expansion",
    "brand_hero_products",
    "clearance_opportunities",
    "roas",
  ],
  dashboardWidgets: [
    "inventory_health",
    "clearance_opportunities",
    "winning_products",
    "campaign_health",
  ],
};

export const PRINT_ON_DEMAND_PACK: DecisionPack = {
  id: "print_on_demand",
  label: "Print on Demand",
  description: "Design-led catalog with variant and creative performance focus.",
  enabledTopics: POD_TOPICS,
  disabledTopics: [
    "dead_inventory",
    "reorder_suggestion",
    "warehouse_optimization",
    "inventory_aging",
    "overstock_detection",
  ],
  enabledRecommendationCategories: [
    "homepage_merchandising",
    "promotion_opportunity",
    "campaign_review",
    "bundle_opportunity",
  ],
  disabledRecommendationCategories: ["low_inventory", "slow_selling"],
  enabledOpportunityCategories: [
    "merchandising",
    "marketing",
    "advertising_efficiency",
    "product_growth",
    "pricing",
  ],
  disabledOpportunityCategories: ["inventory"],
  enabledSimulationTypes: [
    "add_homepage_feature",
    "increase_meta_budget",
    "pause_campaign",
    "apply_discount",
    "decrease_price",
  ],
  disabledSimulationTypes: ["restock_inventory"],
  healthMetricIds: [
    "design_performance",
    "variant_mix",
    "seasonal_opportunities",
    "creative_fatigue",
    "roas",
  ],
  dashboardWidgets: [
    "design_performance",
    "winning_products",
    "creative_fatigue",
    "campaign_health",
  ],
  enableInventoryStrategies: false,
};

export const DIGITAL_PRODUCTS_PACK: DecisionPack = {
  id: "digital_products",
  label: "Digital Products",
  description: "Funnel, conversion, and LTV optimization without physical inventory.",
  enabledTopics: DIGITAL_TOPICS,
  disabledTopics: INVENTORY_TOPICS,
  enabledRecommendationCategories: [
    "homepage_merchandising",
    "promotion_opportunity",
    "campaign_review",
  ],
  disabledRecommendationCategories: ["low_inventory", "slow_selling", "bundle_opportunity"],
  enabledOpportunityCategories: [
    "merchandising",
    "marketing",
    "customer_retention",
    "advertising_efficiency",
    "pricing",
  ],
  disabledOpportunityCategories: ["inventory", "bundle"],
  enabledSimulationTypes: [
    "add_homepage_feature",
    "decrease_price",
    "increase_meta_budget",
    "pause_campaign",
  ],
  disabledSimulationTypes: ["restock_inventory", "create_bundle"],
  healthMetricIds: [
    "funnel_conversion",
    "checkout_conversion",
    "email_conversion",
    "customer_ltv",
    "upsell_rate",
  ],
  dashboardWidgets: ["funnel_conversion", "campaign_health", "subscription_growth"],
  enableInventoryStrategies: false,
};

export const SUBSCRIPTION_PACK: DecisionPack = {
  id: "subscription",
  label: "Subscription",
  description: "Retention, churn, and recurring revenue growth.",
  enabledTopics: SUBSCRIPTION_TOPICS,
  disabledTopics: INVENTORY_TOPICS,
  enabledRecommendationCategories: [
    "promotion_opportunity",
    "campaign_review",
    "homepage_merchandising",
  ],
  disabledRecommendationCategories: ["low_inventory", "slow_selling", "bundle_opportunity"],
  enabledOpportunityCategories: [
    "customer_retention",
    "marketing",
    "pricing",
    "advertising_efficiency",
  ],
  disabledOpportunityCategories: ["inventory", "bundle"],
  enabledSimulationTypes: ["decrease_price", "increase_meta_budget", "pause_campaign"],
  disabledSimulationTypes: ["restock_inventory", "create_bundle", "apply_discount"],
  healthMetricIds: [
    "churn_risk",
    "renewal_rate",
    "trial_conversion",
    "customer_ltv",
    "upsell_rate",
  ],
  dashboardWidgets: ["churn_risk", "subscription_growth", "campaign_health"],
  enableInventoryStrategies: false,
};

export const HYBRID_PACK: DecisionPack = {
  ...OWN_INVENTORY_PACK,
  id: "hybrid",
  label: "Hybrid",
  description: "Combines inventory and growth packs using merchant-configured weights.",
  enableInventoryStrategies: true,
};
