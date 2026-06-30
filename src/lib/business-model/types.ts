export type BusinessModel =
  | "own_inventory"
  | "dropshipping"
  | "private_label"
  | "print_on_demand"
  | "digital_products"
  | "subscription"
  | "hybrid";

export type BusinessModelSource = "manual" | "detected" | "default";

export type SalesChannel =
  | "shopify"
  | "amazon"
  | "etsy"
  | "woocommerce"
  | "direct"
  | "marketplace"
  | "other";

export type InventoryStrategy =
  | "tracked"
  | "untracked"
  | "just_in_time"
  | "dropship"
  | "digital"
  | "mixed";

export type DetectionSignal = {
  signal: string;
  weight: number;
  detail?: string;
};

export type MerchantBusinessProfile = {
  storeId: string;
  businessModel: BusinessModel;
  businessModelSource: BusinessModelSource;
  detectedBusinessModel?: BusinessModel;
  detectionConfidence?: number;
  detectionSignals?: DetectionSignal[];
  primarySalesChannel?: SalesChannel;
  averageOrderValue?: number;
  typicalMarginPct?: number;
  inventoryStrategy?: InventoryStrategy;
  advertisingChannels?: string[];
  primaryAcquisitionChannel?: string;
  hybridModelWeights?: Partial<Record<BusinessModel, number>>;
};

export type BusinessModelHealthMetric = {
  id: string;
  label: string;
  scorePct: number;
  status: "healthy" | "watch" | "critical";
  detail: string;
};

export type BusinessModelHealth = {
  businessModel: BusinessModel;
  overallScorePct: number;
  metrics: BusinessModelHealthMetric[];
};

export type DashboardWidgetId =
  | "inventory_health"
  | "inventory_aging"
  | "clearance_opportunities"
  | "warehouse_value"
  | "winning_products"
  | "scaling_opportunities"
  | "creative_fatigue"
  | "campaign_health"
  | "top_roas_products"
  | "churn_risk"
  | "subscription_growth"
  | "funnel_conversion"
  | "design_performance";

export const BUSINESS_MODEL_LABELS: Record<BusinessModel, string> = {
  own_inventory: "Own Inventory",
  dropshipping: "Dropshipping",
  private_label: "Private Label",
  print_on_demand: "Print on Demand",
  digital_products: "Digital Products",
  subscription: "Subscription",
  hybrid: "Hybrid",
};

export const BUSINESS_MODEL_DESCRIPTIONS: Record<BusinessModel, string> = {
  own_inventory: "Warehouse-based retailer with tracked stock and replenishment cycles.",
  dropshipping: "Supplier-fulfilled catalog with no owned inventory.",
  private_label: "Branded products sourced from manufacturers, often with owned or consigned stock.",
  print_on_demand: "Design-led catalog fulfilled on demand by print partners.",
  digital_products: "Downloadable or license-based products with no physical fulfillment.",
  subscription: "Recurring revenue model focused on retention and LTV.",
  hybrid: "Blends multiple operating models with configurable decision weights.",
};

export function normalizeBusinessModel(raw?: string | null): BusinessModel {
  const key = (raw ?? "own_inventory").toLowerCase().replace(/-/g, "_") as BusinessModel;
  if (key in BUSINESS_MODEL_LABELS) return key;
  return "own_inventory";
}

export function inventoryStrategyForBusinessModel(
  model: BusinessModel,
): InventoryStrategy {
  if (model === "dropshipping" || model === "print_on_demand") return "dropship";
  if (model === "digital_products") return "digital";
  if (model === "hybrid") return "mixed";
  return "tracked";
}
