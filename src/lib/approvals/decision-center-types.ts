import type { ApprovalPresentation, PresentedApprovalCard } from "./presenter";
import type { RecommendationStatus, SupportingMetric } from "@/lib/types";

export type BusinessStatusLevel = "healthy" | "caution" | "pressure" | "critical";

export type BusinessStatusSnapshot = {
  level: BusinessStatusLevel;
  label: string;
  emoji: string;
  summary: string;
};

export type ExecutiveDecisionBriefing = {
  businessStatus: BusinessStatusSnapshot;
  topOpportunityTitle: string | null;
  topOpportunityImpact: number;
  topOpportunityConfidencePct: number;
  urgentDecisions: number;
  pendingDecisions: number;
  completedToday: number;
  narrative: string;
  narrativeHighlights: string[];
};

export type DecisionForecastScenario = {
  estimatedProfit: number;
  estimatedRevenue: number;
  estimatedAdSpend: number;
  roasBefore: string | null;
  roasAfter: string | null;
  confidencePct: number;
  summary: string;
};

export type DecisionMeasuredOutcome = {
  expectedMonthlyProfit: number;
  actualMonthlyProfit: number | null;
  accuracyPct: number | null;
  windowDays: number;
  summary: string | null;
};

export type DecisionMemo = {
  card: PresentedApprovalCard;
  title: string;
  subtitle: string;
  reason: string;
  whyItMatters: string;
  expectedResult: string;
  evidence: SupportingMetric[];
  riskLevel: "Low" | "Medium" | "High";
  lifecycleStatus: RecommendationStatus;
  forecast: DecisionForecastScenario;
  measuredOutcome?: DecisionMeasuredOutcome;
  primaryRecommendationId: string | null;
};

export type DecisionCenterView = {
  briefing: ExecutiveDecisionBriefing;
  primaryDecision: DecisionMemo | null;
  additionalDecisions: DecisionMemo[];
  presentation: ApprovalPresentation;
  visionStatement: string;
};
