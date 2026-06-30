import type { ProductIntelligenceDashboard } from "@/lib/products/types";
import type { AttributionDashboard } from "@/lib/attribution/models";
import type { ProductAttributionDashboard } from "@/lib/attribution/product-types";
import type { AutopilotDashboard } from "@/lib/autopilot/types";
import type { ProfitDashboard } from "@/lib/profit/types";
import type {
  AiDailyBrief,
  AiPerformanceSummary,
  Opportunity,
  Recommendation,
  StoreHealthBreakdown,
  SupportingMetric,
  WeeklyAiReport,
} from "@/lib/types";
import type { SalesTrends } from "@/lib/connectors/types";

import type { CopilotStructuredResponse } from "@/lib/copilot/types";

export type AiActionCard = {
  recommendationId?: string;
  title: string;
  reason: string;
  expectedImpact: string;
  confidence: number;
  actionLabel: string;
};

export type AiChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  structured?: CopilotStructuredResponse;
  actionCards?: AiActionCard[];
  simulation?: SimulationResult;
  createdAt: string;
};

export type SimulationResult = {
  scenario: string;
  summary: string;
  estimatedImpact: string;
  metrics: SupportingMetric[];
  confidence: number;
};

export type RecommendationExplanation = {
  recommendationId: string;
  title: string;
  why: string;
  supportingMetrics: SupportingMetric[];
  risks: string[];
  expectedOutcome: string;
  actualOutcome?: string;
  predictionAccuracy?: number;
  confidenceBreakdown: string;
  confidenceScore: number;
};

export type BusinessContext = {
  storeId: string;
  isDemo: boolean;
  syncedAt: string;
  healthScore: number;
  healthBreakdown: StoreHealthBreakdown;
  storeMetrics: {
    revenue30d: number;
    orders30d: number;
    aov30d: number;
    conversionRate30d: number;
  };
  salesTrends?: SalesTrends;
  productCount: number;
  inventoryUnits: number;
  collectionCount: number;
  discountCount: number;
  topProducts: { title: string; revenue30d: number; unitsSold30d: number; inventory: number }[];
  lowStockProducts: { title: string; inventory: number; daysOfCover: number }[];
  slowProducts: { title: string; unitsSold30d: number; inventory: number }[];
  campaigns: {
    name: string;
    roas7d: number;
    spend7d: number;
    impressions7d: number;
    revenue7d: number;
    frequency7d: number;
    effectiveStatus: string;
  }[];
  hasActiveAdsConnector: boolean;
  hasActiveMetaCampaigns: boolean;
  recommendations: Recommendation[];
  activeRecommendations: Recommendation[];
  topOpportunities: Opportunity[];
  aiBrief: AiDailyBrief;
  aiPerformance: AiPerformanceSummary;
  weeklyReport: WeeklyAiReport;
  dataSourceSummary: string;
  profitDashboard?: ProfitDashboard | null;
  productIntelligence?: ProductIntelligenceDashboard | null;
  productAttribution?: ProductAttributionDashboard | null;
  attributionDashboard?: AttributionDashboard | null;
  autopilotDashboard?: AutopilotDashboard | null;
  merchantMode?: import("@/lib/decisions/merchant-mode").MerchantMode;
};

export type AskAiResponse = {
  message: AiChatMessage;
  sessionId: string;
};

export type SessionMemory = {
  sessionId: string;
  date: string;
  discussedTopics: string[];
  explainedRecommendationIds: string[];
  messageCount: number;
};
