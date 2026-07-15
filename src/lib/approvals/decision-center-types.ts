import type { DecisionImpactPresentation } from "@/lib/impact/decision-impact";
import type { ApprovalPresentation, PresentedApprovalCard } from "./presenter";
import type { RecommendationStatus, SupportingMetric } from "@/lib/types";

export type BusinessStatusLevel = "healthy" | "caution" | "pressure" | "critical";

export type BusinessStatusSnapshot = {
  level: BusinessStatusLevel;
  label: string;
  emoji: string;
  summary: string;
};

export type ExecutiveSummary = {
  headline: string;
  analysisScope: string;
  findingsSummary: string;
  estimatedProfit: number;
  adSpendChange: number;
  revenueChange: number;
  roasBefore: string | null;
  roasAfter: string | null;
  overallRecommendation: string;
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
  executiveSummary: ExecutiveSummary | null;
};

export type ConfidenceBreakdown = {
  confidencePct: number;
  qualitativeLabel: "High Confidence" | "Moderate Confidence" | "Low Confidence";
  summary: string;
  availableSignals: string[];
  missingSignals: string[];
  reducedBecause: string[];
  potentialConfidencePct: number;
};

export type QuantifiedRisk = {
  label: string;
  estimate: string;
  probabilityPct?: number;
  note?: string;
};

export type RiskAnalysis = {
  overallRisk: "Low" | "Medium" | "High";
  quantifiedRisks: QuantifiedRisk[];
  potentialRisks: string[];
  mitigations: string[];
};

export type ActionPlanItem = {
  target: string;
  action: string;
  actionType: "pause" | "reduce_budget" | "increase_budget" | "no_action" | "review" | "other";
  reason?: string;
  currentBudget?: string;
  newBudget?: string;
  currentRoas?: string;
  targetRoas?: string;
  currentProfit?: string;
  estimatedMonthlyImpact?: number;
};

export type CampaignEvidenceRow = {
  campaign: string;
  spend: string;
  revenue: string;
  roas: string;
  cpa?: string;
  profit?: string;
  profitMargin?: string;
  conversionRate?: string;
  clicks?: string;
  ctr?: string;
  budget?: string;
  status?: string;
  trend: "up" | "down" | "flat";
  decision: string;
};

export type FinancialImpactExplanation = {
  title: string;
  paragraphs: string[];
  bullets: string[];
};

export type ExpectedKpi = {
  label: string;
  value: string;
  metricKey?: string;
  positive?: boolean;
};

export type ApprovalPreview = {
  items: string[];
  estimatedMonthlyProfit: number;
  isReversible: boolean;
  monitoringContinues: boolean;
};

export type DecisionTimelineEvent = {
  time: string;
  label: string;
  status: "complete" | "current" | "upcoming";
  isPostApproval?: boolean;
};

export type AiReasoning = {
  summary: string;
  signals: string[];
  signalCount: number;
};

export type BusinessContext = {
  currentGoal: string;
  alignmentStars: number;
  selectedStrategyReason: string;
  alternatives: {
    strategy: string;
    expectedProfit: number;
    expectedRevenue?: number;
    otherMetric?: string;
    otherMetricValue?: string;
  }[];
};

export type AiTrackRecord = {
  hasSufficientData: boolean;
  isDemoData: boolean;
  approvedDecisions: number;
  successful: number;
  successRatePct: number;
  avgMonthlyProfitIncrease: number;
  avgConfidencePct: number;
  falsePositivePct: number;
};

export type SimulationComparison = {
  withoutApproval: {
    profit: number;
    roas: string;
    adSpend: number;
  };
  withApproval: {
    profit: number;
    roas: string;
    adSpend: number;
  };
  difference: {
    profit: number;
    adSpend: number;
    roasPctImprovement: number;
  };
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

export type DecisionDetails = {
  platform: string;
  campaignsAffected: number | null;
  businessGoal: string;
  recommendation: string;
  /** @deprecated Prefer businessRecoveryMonthly — kept for older callers */
  expectedImpactMonthly: number;
  businessRecoveryMonthly: number;
  netProfitMonthly: number;
  advertisingSavingsMonthly: number | null;
};

export type ProfitCalculationLine = {
  label: string;
  value: string;
};

export type ExplainNarrative = {
  question: string;
  paragraphs: string[];
  signalCount: number;
};

export type SimilarDecision = {
  periodLabel: string;
  title: string;
  resultLabel: string;
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
  decisionDetails: DecisionDetails;
  impactPresentation: DecisionImpactPresentation;
  profitCalculation: ProfitCalculationLine[];
  explainNarrative: ExplainNarrative;
  confidenceBreakdown: ConfidenceBreakdown;
  riskAnalysis: RiskAnalysis;
  actionPlan: ActionPlanItem[];
  campaignEvidence: CampaignEvidenceRow[];
  financialImpactExplanation: FinancialImpactExplanation | null;
  expectedKpis: ExpectedKpi[];
  approvalPreview: ApprovalPreview;
  timeline: DecisionTimelineEvent[];
  aiReasoning: AiReasoning;
  businessContext: BusinessContext;
  simulationComparison: SimulationComparison | null;
};

export type DecisionCenterView = {
  briefing: ExecutiveDecisionBriefing;
  primaryDecision: DecisionMemo | null;
  additionalDecisions: DecisionMemo[];
  presentation: ApprovalPresentation;
  visionStatement: string;
  trackRecord: AiTrackRecord | null;
  similarDecisions: SimilarDecision[];
};
