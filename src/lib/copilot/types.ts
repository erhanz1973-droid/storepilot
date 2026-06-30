import type { FutureActionType } from "@/lib/insights/actions";
import type { CommerceOpportunity } from "@/lib/insights/opportunity-schema";
import type { BusinessRiskAssessment } from "@/lib/insights/business-risk-assessment";
import type { SupportingMetric } from "@/lib/types";

export type CopilotDataSource =
  | "shopify"
  | "google_ads"
  | "meta_ads"
  | "ga4"
  | "klaviyo"
  | "integration_health"
  | "store_health"
  | "insights"
  | "priority_queue"
  | "trends"
  | "profit"
  | "attribution"
  | "predictions"
  | "customers"
  | "all";

export type CopilotIntent =
  | "sales_yesterday"
  | "sales_decrease"
  | "roas_decrease"
  | "roas_meta_compare"
  | "roas_google"
  | "pause_campaigns"
  | "today"
  | "product_ads_budget"
  | "product_profit_hurt"
  | "what_changed_week"
  | "biggest_opportunities"
  | "biggest_risk"
  | "best_channel"
  | "store_health_explain"
  | "predict_revenue"
  | "restock"
  | "profit_decrease"
  | "customer_top"
  | "customer_intelligence"
  | "product_intelligence"
  | "inventory_intelligence"
  | "marketing_intelligence"
  | "general";

export type CopilotActionRecommendation = {
  action: string;
  detail: string;
  futureAction?: FutureActionType;
  available: boolean;
};

export type CopilotBusinessImpact = {
  monthlyRevenue?: number;
  monthlyProfit?: number;
  roasImprovement?: number;
  label: string;
  calculable: boolean;
  reasonIfNot?: string;
};

export type CopilotStructuredResponse = {
  /** Metric-validated headline — set by insight validation before responding. */
  title?: string;
  summary: string;
  /** Causal explanation of why the week's primary change occurred. */
  whyItHappened?: string;
  evidence: SupportingMetric[];
  confidencePct: number;
  recommendations: CopilotActionRecommendation[];
  businessImpact: CopilotBusinessImpact;
  relatedInsights: Pick<CommerceOpportunity, "id" | "title" | "source">[];
  dataSourcesUsed: CopilotDataSource[];
  intent: CopilotIntent;
  bottleneck?: import("./insight-engine").InsightBottleneck;
  metricsConflict?: boolean;
  /** Capabilities unlocked after connecting missing data sources. */
  unlockCapabilities?: string[];
  /** Example questions the AI can answer once data is available. */
  futureInsightExamples?: string[];
  riskAssessment?: BusinessRiskAssessment;
};

export const COPILOT_SUGGESTED_PROMPTS = [
  "What should I do today?",
  "Show biggest opportunities",
  "Explain my Store Health Score",
  "Why did revenue drop?",
  "What changed this week?",
  "Which campaign should I pause?",
  "Predict next week's revenue",
  "Why is ROAS decreasing?",
  "Which products deserve more budget?",
  "What is my biggest risk?",
  "Which marketing channel is performing best?",
  "Who are my top customers?",
] as const;
