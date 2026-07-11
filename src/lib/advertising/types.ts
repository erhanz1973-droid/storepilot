import type { CampaignRecommendationKind } from "@/lib/analytics/marketing-recommendations";
import type { MarketingChannel } from "@/lib/analytics/types";
import type { ActionRiskLevel } from "@/lib/attribution/decision-engine-types";
import type { CampaignAccessStatus, CampaignEntitlements } from "@/lib/billing/types";

export type AdvertisingPlatformId =
  | "meta"
  | "google"
  | "tiktok"
  | "pinterest"
  | "microsoft";

export type HealthTier = "excellent" | "healthy" | "needs_review" | "weak" | "critical";

export const HEALTH_TIER_LABELS: Record<HealthTier, string> = {
  excellent: "Excellent",
  healthy: "Healthy",
  needs_review: "Needs Review",
  weak: "Weak",
  critical: "Critical",
};

export type TrendDirection = "up" | "down" | "flat";

export type AdvertisingExecutiveOverview = {
  healthScore: number;
  healthTier: HealthTier;
  businessStatus: string;
  businessStatusEmoji: string;
  topOpportunity: string;
  expectedMonthlyProfitImprovement: number;
  spend30d: number;
  revenue30d: number;
  blendedRoas: number;
  aiConfidencePct: number;
  analysisScopeNotice?: string;
  healthFactors?: AdvertisingHealthFactor[];
};

export type AccountWideSummary = {
  totalCampaigns: number;
  healthy: number;
  needAttention: number;
  critical: number;
  improving: number;
  largestOpportunity: { id: string; name: string; impactMonthly: number } | null;
  largestRisk: { id: string; name: string } | null;
  headline: string;
};

export type AdvertisingUpgradeMessaging = {
  scale: string;
  lockedRecommendationCount: number;
  additionalRecommendationsLabel?: string;
};

export type AdvertisingPlatformRow = {
  id: AdvertisingPlatformId;
  label: string;
  connected: boolean;
  spend: number;
  revenue: number;
  roas: number;
  profit: number | null;
  healthScore: number | null;
  healthTier: HealthTier | null;
  lastSync: string | null;
  profitExplanation?: PlatformProfitExplanation;
};

export type PlatformProfitExplanation = {
  headline: string;
  chain: string[];
};

export type AdvertisingHealthFactor = {
  id: string;
  label: string;
  score: number;
  tier: HealthTier;
};

export type HealthExplanationItem = {
  label: string;
  severity: "high" | "medium" | "low";
};

export type AiManagerSummary = {
  headline: string;
  intro: string;
  narrative: string;
  campaignCount: number;
  platformCount: number;
  losingMoneyCount: number;
  scaleReadyCount: number;
  wasteAudienceCount: number;
  expectedMonthlyProfitImprovement: number;
  confidencePct: number;
  insights: { label: string; count: number }[];
};

export type CampaignSpotlight = {
  id: string;
  campaign: string;
  platformLabel: string;
  roas: number;
  profit: number;
  healthScore: number;
  recommendationLabel: string;
  nextAction: string;
  reason: string;
  timelinePreview: TimelineEntry[];
};

export type CreativeSuggestion = {
  headline?: string;
  cta?: string;
  imageReplacement?: string;
  estimatedUpliftPct?: number;
};

export type PackageSimulation = {
  expectedProfitMonthly: number;
  expectedRoas: number;
  risk: ActionRiskLevel;
  rollbackAvailable: boolean;
  confidencePct: number;
  narrative: string;
};

export type DailyPriority = {
  title: string;
  campaignName?: string;
  action: string;
  expectedMonthlyImpact: number;
  estimatedMinutes: number;
  risk: ActionRiskLevel;
  confidencePct: number;
  packageId?: string;
  campaignId?: string;
  narrative: string;
};

export type SinceLastVisitItem = {
  label: string;
  direction: "up" | "down" | "neutral" | "alert";
  detail?: string;
};

export type SinceLastVisitBriefing = {
  isFirstVisit: boolean;
  lastVisitedAt?: string;
  items: SinceLastVisitItem[];
};

export type TrustEnginePanel = {
  dataQualityPct: number;
  connectedSources: string[];
  historicalCoverageDays: number;
  confidencePct: number;
  predictionReliability: "High" | "Medium" | "Low";
  summary: string;
};

export type AccountabilityItem = {
  id: string;
  type: "rejected" | "approved" | "pending";
  recommendationTitle: string;
  campaignName?: string;
  daysAgo: number;
  narrative: string;
  metrics: { label: string; value: string }[];
  predictionAccuracy?: number;
};

export type LearningInsight = {
  headline: string;
  detail: string;
  personalization: string;
};

export type CrossModuleAlert = {
  module: "Inventory" | "Finance" | "Fulfillment" | "Executive";
  severity: "high" | "medium" | "low";
  message: string;
  blocksAction?: string;
};

export type PredictionRecordItem = {
  title: string;
  expectedImprovement: number;
  actualImprovement: number;
  predictionAccuracy: number;
  status: "validated" | "partial" | "missed";
  measuredDaysAgo?: number;
};

export type PredictionTrackRecord = {
  items: PredictionRecordItem[];
  overallAccuracyPct: number;
  summary: string;
};

export type AiAccountabilityLayer = {
  dailyPriority: DailyPriority;
  sinceLastVisit: SinceLastVisitBriefing;
  trustEngine: TrustEnginePanel;
  accountabilityItems: AccountabilityItem[];
  learningInsight: LearningInsight | null;
  crossModuleAlerts: CrossModuleAlert[];
  predictionTrackRecord: PredictionTrackRecord;
};

export type AdvertisingCampaignRow = {
  id: string;
  campaign: string;
  platform: AdvertisingPlatformId;
  platformLabel: string;
  status: string;
  healthScore: number;
  healthTier: HealthTier;
  spend: number;
  revenue: number;
  profit: number;
  roas: number;
  cpa: number;
  ctr: number;
  conversionRate: number;
  breakEvenRoas: number | null;
  trend: TrendDirection;
  recommendation: CampaignRecommendationKind;
  recommendationLabel: string;
  expectedOpportunityMonthly: number;
  riskLevel: ActionRiskLevel;
  channel: MarketingChannel;
  analysisStatus: CampaignAccessStatus;
  aiScore: number;
  priorityRank: number;
  nextAction: string;
  briefRecommendation: string;
};

export type AdSetRow = {
  id: string;
  campaignId: string;
  name: string;
  spend: number;
  revenue: number;
  roas: number;
  cpa: number;
  ctr: number;
  conversionRate: number;
  frequency: number;
  healthScore: number;
  healthTier: HealthTier;
  recommendation: string;
};

export type AdRow = {
  id: string;
  campaignId: string;
  campaignName: string;
  name: string;
  spend: number;
  clicks: number;
  ctr: number;
  cpc: number;
  purchases: number;
  revenue: number;
  roas: number;
  creativeScore: number;
  recommendation: string;
  previewType: "video" | "ugc" | "carousel" | "image";
  previewLabel: string;
};

export type CreativeIntelRow = {
  id: string;
  name: string;
  campaignName: string;
  creativeScore: number;
  healthTier: HealthTier;
  ctrTrend: TrendDirection;
  fatigue: "low" | "medium" | "high";
  frequency: number;
  thumbStopRate: number | null;
  engagement: number;
  estimatedRemainingDays: number;
  recommendation: string;
  problems: CreativeProblem[];
  aiCommentary: string;
  previewType: "video" | "ugc" | "carousel" | "image";
  fatigueScore?: number;
  suggestions?: CreativeSuggestion;
};

export type CreativeProblem = {
  label: string;
  severity: "high" | "medium" | "low";
};

export type AudienceType =
  | "broad"
  | "lookalike"
  | "interest"
  | "retargeting"
  | "custom";

export const AUDIENCE_TYPE_LABELS: Record<AudienceType, string> = {
  broad: "Broad",
  lookalike: "Lookalike",
  interest: "Interest",
  retargeting: "Retargeting",
  custom: "Custom Audience",
};

export type AudienceRow = {
  type: AudienceType;
  label: string;
  spend: number;
  cpa: number;
  roas: number;
  frequency: number;
  overlapPct: number;
  overlapLevel: "low" | "medium" | "high";
  estimatedWasteMonthly: number;
  healthScore: number;
  healthTier: HealthTier;
  recommendation: string;
};

export type BudgetChannelAllocation = {
  channel: string;
  label: string;
  currentAmount: number;
  recommendedAmount: number;
  direction: "up" | "down" | "flat";
  roas?: number;
  reason?: string;
  expectedGainMonthly?: number;
};

export type OptimizationPackage = {
  id: string;
  rank: number;
  campaignId?: string;
  campaignName?: string;
  title: string;
  steps: string[];
  expectedProfitMonthly: number;
  confidencePct: number;
  risk: ActionRiskLevel;
  estimatedTime: string;
  rollbackAvailable: boolean;
  approvalStatus: "pending" | "approved" | "none" | "rejected";
  decisionId?: string;
  isPackage: boolean;
  simulation?: PackageSimulation;
};

export type OptimizationRecommendation = {
  id: string;
  rank: number;
  title: string;
  campaignId?: string;
  campaignName?: string;
  expectedProfitMonthly: number;
  confidencePct: number;
  risk: ActionRiskLevel;
  effort: "Low" | "Medium" | "High";
  estimatedTime: string;
  rollbackAvailable: boolean;
  approvalStatus: "pending" | "approved" | "none" | "rejected";
  decisionId?: string;
};

export type BenchmarkComparison = {
  campaignId: string;
  yourRoas: number;
  industryAvgRoas: number;
  topQuartileRoas: number;
  yourCpa: number;
  similarStoresCpa: number;
  yourCtr: number;
  industryCtr: number;
};

export type TimelineEntry = {
  id: string;
  campaignId: string;
  date: string;
  type: "created" | "creative" | "budget" | "recommendation" | "approval" | "improvement";
  label: string;
  detail?: string;
};

export type CampaignDetailPageData = {
  syncedAt: string;
  campaign: AdvertisingCampaignRow;
  executiveSummary: string;
  performanceOverview: {
    spend: number;
    revenue: number;
    profit: number;
    roas: number;
    breakEvenRoas: number | null;
    ctr: number;
    trend: TrendDirection;
  };
  profitability: {
    grossMarginPct: number;
    netProfit: number;
    explanation: string;
    chain: string[];
  };
  healthFactors: AdvertisingHealthFactor[];
  adSets: AdSetRow[];
  ads: AdRow[];
  creatives: CreativeIntelRow[];
  audiences: AudienceRow[];
  budgetHistory: { date: string; amount: number; label: string }[];
  approvalHistory: { date: string; title: string; status: string }[];
  aiTimeline: TimelineEntry[];
  optimizationPackage: OptimizationPackage | null;
  simulations: CampaignSimulation[];
  outcomeHistory: CampaignOutcome[];
  benchmarks: BenchmarkComparison;
  planUsage?: CampaignEntitlements;
  locked: boolean;
};

export type CampaignSimulation = {
  id: string;
  label: string;
  profitDeltaMonthly: number;
  probability: "Low" | "Medium" | "High";
};

export type CampaignOutcome = {
  date: string;
  action: string;
  result: string;
  profitImpact: number | null;
};

export type CampaignDetailView = {
  campaignId: string;
  adSets: AdSetRow[];
  ads: AdRow[];
  audiences: AudienceRow[];
  benchmarks: BenchmarkComparison;
  timeline: TimelineEntry[];
  recommendations: OptimizationRecommendation[];
};

export type AdvertisingWorkspaceView = {
  syncedAt: string;
  overview: AdvertisingExecutiveOverview;
  platforms: AdvertisingPlatformRow[];
  campaigns: AdvertisingCampaignRow[];
  adSets: AdSetRow[];
  ads: AdRow[];
  creatives: CreativeIntelRow[];
  audiences: AudienceRow[];
  budgetAllocation: {
    channels: BudgetChannelAllocation[];
    expectedMonthlyProfit: number;
    rationale: string;
    reasons: BudgetShiftReason[];
  };
  optimizationCenter: OptimizationRecommendation[];
  optimizationPackages: OptimizationPackage[];
  timelines: TimelineEntry[];
  aiManager: AiManagerSummary;
  healthExplanations: HealthExplanationItem[];
  topWinners: CampaignSpotlight[];
  topLosers: CampaignSpotlight[];
  accountability: AiAccountabilityLayer;
  accountSummary: AccountWideSummary;
  planUsage?: CampaignEntitlements;
  upgradeMessaging?: AdvertisingUpgradeMessaging;
};

export type BudgetShiftReason = {
  channel: string;
  label: string;
  roas: number;
  direction: "up" | "down" | "flat";
  expectedGainMonthly: number;
  summary: string;
};

export type AdvertisingSortKey =
  | "profit"
  | "roas"
  | "health"
  | "spend"
  | "trend"
  | "risk"
  | "opportunity";

export type AdvertisingFilters = {
  platform: AdvertisingPlatformId | "all";
  status: string | "all";
  healthTier: HealthTier | "all";
  profitability: "all" | "profitable" | "unprofitable";
  risk: ActionRiskLevel | "all";
  recommendation: CampaignRecommendationKind | "all";
  campaignType: string | "all";
};
