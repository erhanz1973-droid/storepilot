export type ImplementationEffort = "Low" | "Medium" | "High";

import type { StoreStatus } from "@/lib/store-status/types";
import type { ProductIntelligenceDashboard } from "@/lib/products/types";
import type { AttributionDashboard } from "@/lib/attribution/models";
import type { AutopilotDashboard } from "@/lib/autopilot/types";
import type { ProfitDashboard } from "@/lib/profit/types";
import type { StoreManagerDashboard } from "@/lib/insights/types";
import type { StoreHealthScore } from "@/lib/store-health/score";
import type { ActivityFeedEntry } from "@/lib/timeline/activity-feed";
import type { PredictiveInsight } from "@/lib/predictions/engine";
import type { OpportunityHistorySummary } from "@/lib/opportunities/history";
import type { AIEvent } from "@/lib/monitoring/types";
import type { MorningExecutiveBrief } from "@/lib/brief/morning-brief";
import type { DecisionItem } from "@/lib/decisions/center";
import type { OutcomeRecord } from "@/lib/learning/outcome-types";
import type { MerchantBusinessProfile, BusinessModelHealth, DashboardWidgetId } from "@/lib/business-model/types";
import type { MerchantBenchmark, MerchantDNA } from "@/lib/merchant-dna/types";
export type { StoreStatus };

export type OpportunityCategory =
  | "inventory"
  | "pricing"
  | "bundle"
  | "merchandising"
  | "marketing"
  | "advertising_efficiency"
  | "product_growth"
  | "marketing_attribution"
  | "customer_retention";

export type AdEfficiencyAction =
  | "increase_budget"
  | "reduce_budget"
  | "pause_campaign"
  | "scale_campaign";

export type Opportunity = {
  id: string;
  category: OpportunityCategory;
  title: string;
  description: string;
  /** @deprecated Use estimatedMonthlyNetProfitImpact for ranking */
  estimatedMonthlyRevenueImpact: number;
  estimatedMonthlyNetProfitImpact: number;
  /** Expected ROAS after implementing this advertising action */
  expectedRoas?: number;
  adEfficiencyAction?: AdEfficiencyAction;
  confidenceScore: number;
  evidence: SupportingMetric[];
  requiredActions: string[];
  implementationEffort: ImplementationEffort;
  recommendationId?: string;
};

export type RecommendationSeverity = "critical" | "high" | "medium" | "low";

export type RecommendationCategory =
  | "low_inventory"
  | "slow_selling"
  | "bundle_opportunity"
  | "homepage_merchandising"
  | "promotion_opportunity"
  | "campaign_review";

export type RecommendationStatus =
  | "pending"
  | "approved"
  | "implemented"
  | "completed"
  | "measured"
  | "ignored"
  | "snoozed";

export type MeasurementKpis = {
  revenue30d?: number;
  unitsSold30d?: number;
  inventoryQuantity?: number;
  roas7d?: number;
  ctr7d?: number;
  spend7d?: number;
  revenue7d?: number;
  aov30d?: number;
  conversionRate30d?: number;
  orders30d?: number;
};

export type RecommendationOutcome = {
  expectedMonthlyImpact: number;
  actualMonthlyImpact: number;
  predictionAccuracy: number;
  baselineMetrics: MeasurementKpis;
  outcomeMetrics: MeasurementKpis;
  outcomeSummary: string;
  measurementWindowDays: number;
  measuredAt: string;
};

/** @deprecated Use RecommendationStatus */
export type ApprovalStatus = RecommendationStatus;

export type SupportingMetric = {
  label: string;
  value: string;
  trend?: "up" | "down" | "flat";
};

export type RecommendationAction = {
  label: string;
  type: "review" | "approve" | "snooze" | "ignore" | "complete";
};

export type AnalyzerOutput = {
  id: string;
  title: string;
  description: string;
  priority: RecommendationSeverity;
  expectedImpact: string;
  confidence: number;
  evidence: SupportingMetric[];
  actions: RecommendationAction[];
  category: RecommendationCategory;
  entityType?: string;
  entityId?: string;
  validation?: import("@/lib/recommendations/validation/types").RecommendationValidationMeta;
  financialImpact?: {
    estimatedMonthlyProfitIncrease?: number | null;
    estimatedMonthlyRevenueIncrease?: number | null;
    estimatedMonthlyCostSavings?: number | null;
  };
};

export type Recommendation = {
  id: string;
  category: RecommendationCategory;
  title: string;
  severity: RecommendationSeverity;
  reason: string;
  expectedImpact: string;
  confidenceScore: number;
  actionLabel: string;
  supportingMetrics: SupportingMetric[];
  entityType?: string;
  entityId?: string;
  createdAt: string;
  status?: RecommendationStatus;
  approvedAt?: string;
  implementedAt?: string;
  completedAt?: string;
  measuredAt?: string;
  snoozedUntil?: string;
  actualImpact?: string;
  predictionAccuracy?: number;
  measurementWindowDays?: number;
  baselineMetrics?: MeasurementKpis;
  outcomeMetrics?: MeasurementKpis;
  outcomeSummary?: string;
};

export type RecommendationApproval = {
  recommendationId: string;
  status: RecommendationStatus;
  note?: string;
  updatedAt: string;
  snoozedUntil?: string;
};

export type RecommendationHistoryEntry = {
  id: string;
  recommendationId: string;
  recommendation: Recommendation;
  status: RecommendationStatus;
  expectedImpact: string;
  confidenceScore: number;
  createdAt: string;
  approvedAt?: string;
  completedAt?: string;
  /** Live campaign delivery status from the latest connector sync */
  campaignStatus?: string;
  campaignStatusLabel?: string;
  /** Meta Ads Manager-style campaign details (status, objective, budget, duration) */
  campaignDetails?: import("@/lib/meta/campaign-details").CampaignMetaDetailsView;
};

export type StoreHealthBreakdown = {
  inventory: number;
  merchandising: number;
  campaigns: number;
  promotions: number;
};

export type AiBriefPriority = {
  rank: number;
  title: string;
  detail: string;
};

export type AiPerformanceSummary = {
  predictionAccuracy: number;
  measuredCount: number;
  revenueInfluenced: number;
  bestCategory: string;
  bestCategoryLabel: string;
};

export type WeeklyAiReport = {
  weekStart: string;
  weekEnd: string;
  recommendationsCompleted: number;
  recommendationsMeasured: number;
  bestPerforming: { title: string; accuracy: number; actualImpact: string } | null;
  worstPrediction: { title: string; accuracy: number; expectedImpact: string; actualImpact: string } | null;
  accuracyTrend: { week: string; accuracy: number }[];
  overallAccuracy: number;
  generatedAt: string;
  /** Phase 13 — executive summary fields */
  revenue30d?: number;
  profit30d?: number;
  roas30d?: number | null;
  bestProducts?: { title: string; profit: number }[];
  worstCampaigns?: { id?: string; name: string; roas: number }[];
  biggestOpportunities?: { title: string; profitImpact: number }[];
  resolvedIssues?: string[];
  topRecommendationNextWeek?: string | null;
  executiveSummary?: string[];
};

export type CategoryLearningStats = {
  category: string;
  label: string;
  sampleSize: number;
  avgAccuracyPct: number;
  avgRealizationPct: number;
  successfulCount?: number;
  needsImprovementCount?: number;
};

export type AiDailyBrief = {
  storeHealth: number;
  revenueOpportunitySummary: string;
  criticalAlertCount: number;
  topPriorities: AiBriefPriority[];
  estimatedRevenueOpportunity: number;
  generatedAt: string;
};

export type DashboardSnapshot = {
  storeHealthScore: number;
  healthBreakdown: StoreHealthBreakdown;
  storeHealth?: StoreHealthScore;
  inventorySummary: InventorySummary;
  topOpportunities: Opportunity[];
  storeStatus: StoreStatus;
  revenueOpportunities: Recommendation[];
  criticalAlerts: Recommendation[];
  aiBrief: AiDailyBrief;
  aiPerformance: AiPerformanceSummary;
  weeklyReport: WeeklyAiReport;
  activityFeed?: ActivityFeedEntry[];
  aiEvents?: AIEvent[];
  morningBrief?: MorningExecutiveBrief;
  decisionCenter?: DecisionItem[];
  outcomeRecords?: OutcomeRecord[];
  businessProfile?: MerchantBusinessProfile;
  businessModelHealth?: BusinessModelHealth;
  dashboardWidgets?: DashboardWidgetId[];
  merchantDna?: MerchantDNA;
  merchantBenchmark?: MerchantBenchmark;
  predictiveInsights?: PredictiveInsight[];
  opportunityHistory?: OpportunityHistorySummary;
  lastAnalyzedAt: string;
  profitDashboard?: ProfitDashboard | null;
  productIntelligence?: ProductIntelligenceDashboard | null;
  attributionDashboard?: AttributionDashboard | null;
  autopilotDashboard?: AutopilotDashboard | null;
  storeManager?: StoreManagerDashboard | null;
  connectorStates?: Partial<Record<DataSourceId, ConnectorStatus>>;
  hasActiveAdsConnector?: boolean;
  hasActiveMetaCampaigns?: boolean;
  validationGate?: import("@/lib/recommendations/validation/types").ValidationGateReport;
};

export type InventorySummary = {
  totalProducts: number;
  inStock: number;
  outOfStock: number;
  lowStock: number;
  lowStockThreshold: number;
};

export type DataSourceId =
  | "shopify"
  | "meta_ads"
  | "google_ads"
  | "ga4"
  | "klaviyo"
  | "tiktok"
  | "erp";

export type ConnectorStatus = "connected" | "demo" | "disconnected" | "error";

export type DataSourceStatus = {
  id: DataSourceId;
  label: string;
  status: ConnectorStatus;
  lastSyncAt?: string;
  errorMessage?: string;
};

export const DEMO_STORE_ID = "00000000-0000-4000-8000-000000000001";
