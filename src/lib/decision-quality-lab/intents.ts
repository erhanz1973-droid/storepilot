/** Business intent taxonomy — semantic evaluation layer above keyword matching */

export type DecisionIntent =
  | "reduce_advertising"
  | "increase_advertising"
  | "inventory_clearance"
  | "bundle_products"
  | "creative_refresh"
  | "landing_page_optimization"
  | "scaling"
  | "profit_preservation"
  | "cash_flow_improvement"
  | "customer_acquisition"
  | "inventory_replenishment"
  | "roas_optimization"
  | "conversion_optimization"
  | "pricing_adjustment"
  | "retention"
  | "merchandising"
  | "campaign_review"
  | "healthy_baseline";

export type IntentDefinition = {
  id: DecisionIntent;
  label: string;
  /** Substrings / phrases that indicate this intent in decision text */
  acceptPatterns: string[];
  /** Patterns that indicate a conflicting intent */
  rejectPatterns?: string[];
};

export const DECISION_INTENT_TAXONOMY: IntentDefinition[] = [
  {
    id: "reduce_advertising",
    label: "Reduce Advertising Spend",
    acceptPatterns: [
      "pause campaign",
      "pause ad",
      "reduce budget",
      "reduce spend",
      "stop meta",
      "disable ad",
      "cut spend",
      "lower budget",
      "turn off",
      "underperforming campaign",
      "roas collapse",
      "high cpc",
      "cpa too high",
    ],
    rejectPatterns: ["increase budget", "scale campaign", "launch new"],
  },
  {
    id: "increase_advertising",
    label: "Increase Advertising",
    acceptPatterns: [
      "increase budget",
      "scale campaign",
      "scale meta",
      "scale google",
      "raise budget",
      "expand spend",
      "winner",
      "launch campaign",
      "boost spend",
    ],
    rejectPatterns: ["pause", "reduce budget", "cut spend"],
  },
  {
    id: "inventory_clearance",
    label: "Inventory Clearance",
    acceptPatterns: [
      "clearance",
      "dead inventory",
      "slow selling",
      "slow mover",
      "overstock",
      "aged inventory",
      "discount slow",
      "liquidate",
      "inventory aging",
    ],
    rejectPatterns: ["reorder", "restock"],
  },
  {
    id: "bundle_products",
    label: "Bundle Products",
    acceptPatterns: ["bundle", "kit", "pair with", "combine products"],
  },
  {
    id: "creative_refresh",
    label: "Creative Refresh",
    acceptPatterns: [
      "creative fatigue",
      "refresh creative",
      "new creative",
      "ad creative",
      "fatigued",
      "refresh ad",
    ],
  },
  {
    id: "landing_page_optimization",
    label: "Landing Page Optimization",
    acceptPatterns: [
      "landing page",
      "homepage",
      "funnel",
      "checkout",
      "conversion rate",
      "low conversion",
    ],
  },
  {
    id: "scaling",
    label: "Scaling",
    acceptPatterns: [
      "scaling opportunity",
      "scale winner",
      "scale budget",
      "scale campaign",
      "hero product",
      "winning product",
    ],
  },
  {
    id: "profit_preservation",
    label: "Profit Preservation",
    acceptPatterns: [
      "margin",
      "profit",
      "preserve margin",
      "low margin",
      "losing money",
      "underpriced",
      "price too low",
    ],
  },
  {
    id: "cash_flow_improvement",
    label: "Cash Flow Improvement",
    acceptPatterns: ["cash flow", "cash trap", "tied up in inventory", "free cash"],
  },
  {
    id: "customer_acquisition",
    label: "Customer Acquisition",
    acceptPatterns: [
      "acquisition",
      "new customers",
      "prospecting",
      "grow traffic",
      "organic growth",
    ],
  },
  {
    id: "inventory_replenishment",
    label: "Inventory Replenishment",
    acceptPatterns: [
      "reorder",
      "restock",
      "low stock",
      "replenish",
      "purchase order",
      "warehouse",
    ],
    rejectPatterns: ["clearance", "dead inventory"],
  },
  {
    id: "roas_optimization",
    label: "ROAS Optimization",
    acceptPatterns: [
      "roas",
      "return on ad spend",
      "campaign efficiency",
      "attribution",
      "google outperform",
      "meta outperform",
      "shift budget",
    ],
  },
  {
    id: "conversion_optimization",
    label: "Conversion Optimization",
    acceptPatterns: [
      "conversion",
      "checkout",
      "add to cart",
      "funnel drop",
    ],
  },
  {
    id: "pricing_adjustment",
    label: "Pricing Adjustment",
    acceptPatterns: [
      "price too high",
      "price too low",
      "pricing",
      "raise price",
      "lower price",
      "discount",
    ],
  },
  {
    id: "retention",
    label: "Retention / Churn",
    acceptPatterns: ["churn", "retention", "subscription", "refund rate", "repeat"],
  },
  {
    id: "merchandising",
    label: "Merchandising",
    acceptPatterns: [
      "homepage merchandising",
      "feature product",
      "collection",
      "merchandising",
      "seasonal",
    ],
  },
  {
    id: "campaign_review",
    label: "Campaign Review",
    acceptPatterns: ["campaign review", "review campaign", "audit campaign"],
  },
  {
    id: "healthy_baseline",
    label: "Healthy Baseline",
    acceptPatterns: ["healthy", "on track", "no critical"],
  },
];

export const INTENT_LABELS: Record<DecisionIntent, string> = Object.fromEntries(
  DECISION_INTENT_TAXONOMY.map((d) => [d.id, d.label]),
) as Record<DecisionIntent, string>;

/** Scenario → expected intents (semantic regression expectations) */
export const SCENARIO_EXPECTED_INTENTS: Record<string, DecisionIntent[]> = {
  dead_inventory: ["inventory_clearance", "bundle_products"],
  winning_product: ["scaling", "increase_advertising"],
  roas_collapse: ["reduce_advertising", "roas_optimization"],
  creative_fatigue: ["creative_refresh", "campaign_review"],
  inventory_overstock: ["inventory_clearance", "bundle_products"],
  low_conversion: ["conversion_optimization", "landing_page_optimization"],
  high_cpc: ["reduce_advertising", "roas_optimization"],
  high_refund_rate: ["profit_preservation", "retention"],
  seasonal_demand: ["merchandising", "inventory_replenishment"],
  scaling_opportunity: ["scaling", "increase_advertising"],
  cash_flow_crisis: ["cash_flow_improvement", "inventory_clearance"],
  subscription_churn: ["retention"],
  price_too_high: ["pricing_adjustment", "conversion_optimization"],
  price_too_low: ["pricing_adjustment", "profit_preservation"],
  google_outperforms_meta: ["roas_optimization", "increase_advertising"],
  meta_outperforms_google: ["roas_optimization", "increase_advertising"],
  organic_growth: ["merchandising", "customer_acquisition"],
  launch_campaign: ["scaling", "increase_advertising"],
  healthy_store: [],
};

export const DROPSHIPPING_FORBIDDEN_INTENTS: DecisionIntent[] = [
  "inventory_clearance",
  "inventory_replenishment",
];
