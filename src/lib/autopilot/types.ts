import type { Opportunity, Recommendation } from "@/lib/types";

export type AutopilotPriority = "Critical" | "High" | "Medium" | "Low";

export type ExecutiveHealthBreakdown = {
  profitability: number;
  growth: number;
  marketing: number;
  inventory: number;
  acquisition: number;
  retention: number;
  operations: number;
};

export type ExecutiveHealthScore = {
  score: number;
  label: "Excellent" | "Good" | "Fair" | "At Risk";
  breakdown: ExecutiveHealthBreakdown;
  changeReasons: string[];
  previousScore?: number;
};

export type StoreBriefMetrics = {
  revenue30d: number;
  netProfit30d: number;
  profitMarginPct: number;
  blendedRoas: number | null;
  cac: number | null;
  bestProduct: string | null;
  worstProduct: string | null;
  inventoryRiskCount: number;
  advertisingChange: string | null;
  newOpportunityCount: number;
};

export type ExecutiveDailyBrief = {
  title: string;
  generatedAt: string;
  headline: string;
  metrics: StoreBriefMetrics;
  sections: { label: string; content: string }[];
  topAction: string | null;
  confidencePct: number;
};

export type AutopilotAction = {
  id: string;
  source: "opportunity" | "recommendation" | "alert" | "budget" | "pricing" | "inventory";
  priority: AutopilotPriority;
  title: string;
  description: string;
  expectedNetProfitGain: number;
  confidenceScore: number;
  estimatedMinutes: number;
  businessImpact: string;
  actionLabel: string;
  category?: string;
};

export type ForecastScenario = {
  revenue: number;
  profit: number;
  roas: number | null;
  cashFlow: number;
};

export type ProfitForecast = {
  horizonDays: 7 | 30 | 90;
  optimistic: ForecastScenario;
  expected: ForecastScenario;
  conservative: ForecastScenario;
  confidencePct: number;
};

export type InventoryForecastRow = {
  productId: string;
  title: string;
  inventory: number;
  daysRemaining: number | null;
  risk: "stockout" | "overstock" | "healthy";
  recommendedPurchaseDate: string | null;
  lostRevenueRisk: number;
  lostProfitRisk: number;
};

export type BudgetRecommendation = {
  id: string;
  action: "increase_budget" | "reduce_budget" | "shift_budget" | "pause_campaign" | "duplicate_winner";
  target: string;
  fromChannel?: string;
  toChannel?: string;
  expectedNetProfitGain: number;
  confidenceScore: number;
  reasoning: string;
};

export type PricingRecommendation = {
  productId: string;
  title: string;
  action: "increase_price" | "reduce_price" | "bundle" | "remove_discount" | "start_promotion";
  currentPrice: number;
  suggestedChange: string;
  expectedRevenueChange: number;
  expectedProfitChange: number;
  expectedConversionChangePct: number;
  confidenceScore: number;
};

export type AutopilotAlert = {
  id: string;
  type:
    | "profit_drop"
    | "roas_drop"
    | "traffic_anomaly"
    | "inventory_risk"
    | "refund_spike"
    | "campaign_fatigue"
    | "margin_deterioration";
  severity: AutopilotPriority;
  title: string;
  reason: string;
  businessImpact: string;
  suggestedAction: string;
  confidenceScore: number;
};

export type TimelineEntry = {
  id: string;
  date: string;
  dayLabel: string;
  event: string;
  outcome?: string;
  status: "accepted" | "rejected" | "pending" | "measured" | "info";
  impactPct?: number;
};

export type AutopilotDashboard = {
  syncedAt: string;
  executiveBrief: ExecutiveDailyBrief;
  executiveHealth: ExecutiveHealthScore;
  actions: AutopilotAction[];
  profitForecasts: ProfitForecast[];
  inventoryForecasts: InventoryForecastRow[];
  budgetRecommendations: BudgetRecommendation[];
  pricingRecommendations: PricingRecommendation[];
  alerts: AutopilotAlert[];
  timeline: TimelineEntry[];
};

export type AutopilotContext = {
  snapshot: import("@/lib/connectors/types").StoreSnapshot;
  profitDashboard: import("@/lib/profit/types").ProfitDashboard | null;
  productIntelligence: import("@/lib/products/types").ProductIntelligenceDashboard | null;
  attributionDashboard: import("@/lib/attribution/models").AttributionDashboard | null;
  topOpportunities: Opportunity[];
  activeRecommendations: Recommendation[];
  criticalAlerts: Recommendation[];
  storeHealthScore: number;
};
