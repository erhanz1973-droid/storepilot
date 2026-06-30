import type { SupportingMetric } from "@/lib/types";
import type { FutureActionType } from "./actions";
import type { CommerceDailyBrief } from "./daily-brief";
import type { ExecutiveSummary } from "./executive-summary";
import type { CommerceOpportunity } from "./opportunity-schema";

export type InsightPriority = "critical" | "high" | "medium" | "low";

export type InsightCategory =
  | "roas"
  | "campaign_performance"
  | "spend_efficiency"
  | "channel_comparison"
  | "product_ads"
  | "conversion"
  | "retention"
  | "trend"
  | "inventory"
  | "pricing";

export type StoreInsight = {
  id: string;
  priority: InsightPriority;
  category: InsightCategory;
  title: string;
  summary: string;
  recommendation: string;
  /** 0–100 */
  confidence: number;
  why: SupportingMetric[];
  evidence: SupportingMetric[];
  relatedEntityType?: "campaign" | "product" | "channel";
  relatedEntityId?: string;
  futureAction?: FutureActionType;
};

export type TrendWindow = "7d" | "30d" | "90d";

export type TrendMetric = {
  id: string;
  label: string;
  window: TrendWindow;
  current: number;
  previous: number;
  changePct: number | null;
  direction: "up" | "down" | "flat";
  unit: "currency" | "percent" | "ratio" | "count";
};

export type TrendAnalysis = {
  metrics: TrendMetric[];
  interpretation: string;
  generatedAt: string;
};

export type PriorityQueueItem = {
  id: string;
  priority: InsightPriority;
  title: string;
  summary: string;
  confidence: number;
  expectedImpactLabel?: string;
  source: "insight" | "opportunity" | "recommendation" | "alert";
  insightId?: string;
  opportunityId?: string;
  recommendationId?: string;
  futureAction?: FutureActionType;
};

export type StoreManagerDashboard = {
  dailyQuestion: string;
  integrationHealth: import("@/lib/integrations/health").IntegrationHealthCard[];
  trends: TrendAnalysis;
  /** Unified prioritized opportunity feed (all sources) */
  opportunityFeed: CommerceOpportunity[];
  /** @deprecated Use opportunityFeed */
  insights: StoreInsight[];
  executiveSummary: ExecutiveSummary;
  dailyBrief: CommerceDailyBrief;
  priorityQueue: PriorityQueueItem[];
  generatedAt: string;
};
