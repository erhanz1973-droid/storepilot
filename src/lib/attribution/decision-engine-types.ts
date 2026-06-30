export type ImpactVerificationStatus = "Simulated" | "Estimated" | "Verified";

export type MetricSnapshot = {
  spend?: number;
  roas?: number;
  profit?: number;
};

export type ConfidenceBreakdown = {
  dataCompletenessPct: number;
  attributionQualityPct: number;
  historicalStabilityPct: number;
  sampleSizePct: number;
  overallPct: number;
};

export type RecommendationExpiration = {
  generatedAt: string;
  validUntil: string;
  validityDays: number;
  isExpired: boolean;
  message: string;
};

export type RecommendationDependency = {
  id: string;
  label: string;
  met: boolean;
  required: boolean;
};

export type ActionImpactProfile = {
  simulationStatus: ImpactVerificationStatus;
  estimatedMonthlyImprovement: number;
  observedMonthlyImprovement: number | null;
  observedStatus: ImpactVerificationStatus | null;
  matchedRecommendationId?: string;
  matchedOutcomeId?: string;
};

export type StrategyAssumption = {
  id: string;
  text: string;
  valid: boolean;
};

export type CrossModuleImpact = {
  module: "Marketing" | "Inventory" | "Profit" | "Customer";
  headline: string;
  detail: string;
  verificationStatus: ImpactVerificationStatus;
  severity?: "healthy" | "low" | "critical" | "unknown";
};

export type OpportunityCost = {
  summary: string;
  items: string[];
};

export type OptimizationWorkflowStep = {
  step: number;
  label: string;
  waitDays?: number;
};

export type ObjectiveReconciliation = {
  statedObjective: string;
  selectedStrategyFocus: string;
  aligned: boolean;
  explanation: string;
  suggestedObjective?: string;
};

export type AttributionExecutiveSummary = {
  businessStatus: "Profitable" | "Unprofitable" | "Break-even";
  businessStatusIndicator: "green" | "amber" | "red";
  primaryIssue: string;
  bestOpportunity: string;
  estimatedMonthlyImpact: number;
  riskLevel: ActionRiskLevel;
  overallRecommendation: string;
};

export type AttributionHistoryEntry = {
  date: string;
  isoDate: string;
  title: string;
  status: "Applied" | "Ignored" | "Pending" | "Measured" | "Dismissed";
  verificationStatus?: ImpactVerificationStatus;
};

export type LearningFeedback = {
  recommendationTitle: string;
  recommendationId?: string;
  outcomeId?: string;
  appliedAt: string;
  verificationStatus: ImpactVerificationStatus;
  before?: MetricSnapshot;
  after?: MetricSnapshot;
  estimatedImprovement?: number;
  observedImprovement?: number | null;
  resultSummary?: string;
  status: "Successful" | "Inconclusive" | "Underperforming" | "Pending measurement";
};

export type AttributionStrategyId =
  | "scale"
  | "optimize"
  | "reallocate"
  | "reduce_budget"
  | "pause";

export type ActionRiskLevel = "Low" | "Medium" | "High";

export type AttributionStrategyActionCore = {
  rank: number;
  id: string;
  title: string;
  description: string;
  reason: string;
  estimatedMonthlyImprovement: number;
  confidencePct: number;
  riskLevel: ActionRiskLevel;
  expectedRevenueImpactPct: number;
  cashFlowImpact: "Positive" | "Neutral" | "Negative";
  isLastResort?: boolean;
  priorityScore?: number;
  rankExplanation?: string;
};

export type AttributionStrategyAction = AttributionStrategyActionCore & {
  impact: ActionImpactProfile;
  dependencies: RecommendationDependency[];
  crossModuleImpacts: CrossModuleImpact[];
  opportunityCost: OpportunityCost;
  workflowSteps: OptimizationWorkflowStep[];
};

export type StrategyAlternative = {
  strategy: AttributionStrategyId;
  label: string;
  score: number;
  selected: boolean;
  reason: string;
  whyNot: string[];
};

export type SimulationScenario = {
  id: string;
  label: string;
  profitDeltaLow: number;
  profitDeltaHigh: number;
  revenueDeltaPctLow: number;
  revenueDeltaPctHigh: number;
  probability: "Low" | "Medium" | "High";
  expectedTime: string;
};

export type AttributionSimulationCore = {
  scope: string;
  currentSpend: number;
  currentRoas: number;
  breakEvenRoas: number;
  scenarios: SimulationScenario[];
};

export type AttributionSimulation = AttributionSimulationCore & {
  verificationStatus: ImpactVerificationStatus;
};

export type RecommendationStability = {
  status: "Stable" | "Monitoring" | "Volatile";
  message: string;
  daysAboveThreshold: number;
};

export type DecisionPrecondition = {
  id: string;
  text: string;
  sentiment: "positive" | "negative" | "neutral";
};

export type AttributionBusinessObjective =
  | "maximize_profit"
  | "maximize_revenue"
  | "maximize_growth"
  | "preserve_cash_flow"
  | "clear_inventory";

export type { BreakEvenRoasModel } from "./break-even-roas";

export type AttributionStrategyPlanCore = {
  strategy: AttributionStrategyId;
  strategyLabel: string;
  targetScope: string;
  confidencePct: number;
  reason: string;
  preconditions: DecisionPrecondition[];
  strategyAlternatives: StrategyAlternative[];
  breakEvenModel: import("./break-even-roas").BreakEvenRoasModel;
  businessObjective: AttributionBusinessObjective;
  businessObjectiveLabel: string;
  simulation: AttributionSimulationCore;
  stability: RecommendationStability;
  actions: AttributionStrategyActionCore[];
  metricsSummary: {
    netProfit: number;
    cacGapPct: number | null;
    roasGapPct: number | null;
    totalSpend: number;
  };
};

export type AttributionStrategyPlan = Omit<
  AttributionStrategyPlanCore,
  "actions" | "simulation"
> & {
  confidenceBreakdown: ConfidenceBreakdown;
  expiration: RecommendationExpiration;
  assumptions: StrategyAssumption[];
  learningFeedback: LearningFeedback[];
  recommendationHistory: AttributionHistoryEntry[];
  simulation: AttributionSimulation;
  executiveSummary: AttributionExecutiveSummary;
  objectiveReconciliation: ObjectiveReconciliation;
  optimizationWorkflow: OptimizationWorkflowStep[];
  actions: AttributionStrategyAction[];
};
