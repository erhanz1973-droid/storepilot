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
  | "plan_campaign_locked"
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

export type CopilotConfidenceLevel = "high" | "medium" | "low";

export type CopilotRiskLevel = "low" | "moderate" | "high";

export type CopilotEffortLevel = "low" | "medium" | "high";

export type CopilotTradeOff = {
  upsideLabel: string;
  upsideValue: string;
  downsideLabel: string;
  downsideValue: string;
  stabilizationTime: string;
};

export type CopilotWaitAnalysis = {
  period: string;
  unnecessarySpend: string | null;
  missedProfit: string | null;
  learningQuality: string;
  businessRisk: string;
};

export type CopilotWhyNotAlternative = {
  label: string;
  reason: string;
};

export type CopilotFinancialImpact = {
  combinedNetMonthly: number | null;
  combinedLabel: string;
  overlapNote?: string;
  calculable: boolean;
};

export type CopilotRecommendationCard = {
  rank: number;
  recommendedAction: string;
  problem: string;
  effort: CopilotEffortLevel;
  effortLabel: string;
  timeUntilResults: string;
  includedInCombined: boolean;
  /** @deprecated Use top-level financialImpact — kept for action card compat */
  expectedFinancialImpact: string;
  impactMonthly: number | null;
  difficulty: "Low" | "Medium" | "High";
  confidencePct: number;
  riskLevel: CopilotRiskLevel;
  riskReason: string;
  currentPerformance?: string;
  inactionLabel?: string;
  inactionAmountMonthly?: number | null;
};

export type CopilotConversationalMode = "standard" | "wait" | "why_priority";

export type CopilotImpactCalculation = {
  factors: string[];
  summary: string;
};

export type CopilotExecutiveDecision = {
  decision: string;
  reason: string;
  estimatedBenefit: string;
  confidenceLevel: CopilotConfidenceLevel;
  confidencePct: number;
  riskLevel: CopilotRiskLevel;
  riskReason: string;
};

export type CopilotConversationalLayer = {
  mode: CopilotConversationalMode;
  shortAnswer: string;
  cautionNote?: string;
  whySummary?: string;
  supportingMetrics: string[];
  financialImpact: CopilotFinancialImpact;
  recommendedAction: string;
  prioritizedRecommendations: CopilotRecommendationCard[];
  remainingOpportunityCount: number;
  whyFirstPriority: string[];
  tradeOff: CopilotTradeOff;
  waitAnalysis: CopilotWaitAnalysis;
  whyNotAlternatives: CopilotWhyNotAlternative[];
  impactCalculation: CopilotImpactCalculation;
  confidence: {
    level: CopilotConfidenceLevel;
    pct: number;
    basis: string[];
  };
  risk: {
    level: CopilotRiskLevel;
    reason: string;
  };
  nextStep: string;
  nextStepDuration: string;
  followUpQuestion: string;
  /** @deprecated Legacy field — no longer rendered */
  whyBullets?: string[];
  /** @deprecated Legacy field — no longer rendered */
  followUpQuestions?: string[];
  /** @deprecated Legacy field — no longer rendered */
  executiveDecision?: CopilotExecutiveDecision;
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
  /** Conversational performance-marketing layer for Ask AI UI. */
  conversational?: CopilotConversationalLayer;
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
