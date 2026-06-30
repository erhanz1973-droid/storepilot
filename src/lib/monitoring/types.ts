import type { FutureActionType } from "@/lib/insights/actions";
import type { SupportingMetric } from "@/lib/types";

export type AIEventType =
  | "revenue_change"
  | "roas_change"
  | "inventory_risk"
  | "campaign_issue"
  | "customer_change"
  | "marketing_efficiency"
  | "prediction_alert"
  | "opportunity_detected";

export type AIEventSeverity = "info" | "warning" | "critical";

export type AIEvent = {
  id: string;
  type: AIEventType;
  severity: AIEventSeverity;
  title: string;
  description: string;
  evidence: SupportingMetric[];
  recommendation: string;
  confidencePct: number;
  estimatedImpact?: {
    monthlyRevenue?: number;
    monthlyProfit?: number;
    label: string;
  };
  futureAction?: FutureActionType;
  actionAvailable: boolean;
  createdAt: string;
  monitor: string;
};

export type MonitorContext = {
  syncedAt: string;
  snapshot: import("@/lib/connectors/types").StoreSnapshot;
  profitDashboard: import("@/lib/profit/types").ProfitDashboard | null;
  productIntelligence: import("@/lib/products/types").ProductIntelligenceDashboard | null;
  attributionDashboard: import("@/lib/attribution/models").AttributionDashboard | null;
  opportunities: import("@/lib/insights/opportunity-schema").CommerceOpportunity[];
  predictiveInsights: import("@/lib/predictions/engine").PredictiveInsight[];
};
