import type { BusinessRiskAssessment } from "@/lib/insights/business-risk-assessment";

export type BusinessHealthStatus = "healthy" | "warning" | "critical" | "limited";

export type DomainTrend = {
  windowLabel: "30-Day Trend" | "7-Day Trend";
  direction: "improving" | "declining" | "stable";
  label: string;
  deltaPoints: number | null;
};

export type FinancialImpactType =
  | "revenue_increase"
  | "profit_recovery"
  | "cost_reduction"
  | "cash_flow_improvement"
  | "risk_prevention";

export type InactionConsequence = {
  label: string;
  amountMonthly: number | null;
};

export type BusinessHealthDomain = {
  id: string;
  label: string;
  score: number;
  status: BusinessHealthStatus;
  currentSituation: string;
  whyItMatters: string;
  recommendedAction: string;
  expectedOutcome: string;
  financialImpactType: FinancialImpactType;
  estimatedImpact: string | null;
  estimatedImpactMonthly: number | null;
  inactionConsequence: InactionConsequence | null;
  trend: DomainTrend;
  /** @deprecated use currentSituation */
  why?: string;
};

export type BusinessHealthTrend = {
  direction: "improving" | "declining" | "stable";
  label: string;
  detail: string;
  deltaPoints: number | null;
};

export type HealthOverallCard = {
  score: number;
  maxScore: number;
  label: string;
  statusEmoji: string;
  primaryIssue: string;
  biggestOpportunity: string;
  trend: BusinessHealthTrend;
  lastUpdated: string;
};

export type HealthExecutiveSummary = {
  headline: string;
  narrative: string;
  highestPriority: string;
  estimatedMonthlyImprovement: string | null;
  estimatedMonthlyImprovementValue: number | null;
  briefingParagraphs: string[];
};

export type HealthScoreBreakdownRow = {
  id: string;
  label: string;
  score: number;
  weightPct: number;
};

export type HealthHistoryPoint = {
  date: string;
  score: number;
};

export type BenchmarkRow = {
  id: string;
  label: string;
  percentile: number;
  interpretationKind: "strength" | "weakness" | "neutral";
  interpretation: string;
};

export type BusinessStrength = {
  id: string;
  label: string;
  detail: string;
};

export type RiskDistribution = {
  critical: number;
  warning: number;
  healthy: number;
  limited: number;
};

export type HealthActionItem = {
  rank: number;
  title: string;
  impactLabel: string;
  impactMonthly: number | null;
  financialImpactType: FinancialImpactType;
  category: string;
  difficulty: "Low" | "Medium" | "High";
  timeRequired: string;
  confidence: string;
  timeUntilResults: string;
};

export type ExecutiveDecision = {
  title: string;
  decision: string;
  reason: string;
  estimatedBenefit: string;
  estimatedBenefitMonthly: number | null;
};

export type BusinessHealthDashboard = {
  generatedAt: string;
  storeId: string;
  overall: HealthOverallCard;
  executiveSummary: HealthExecutiveSummary;
  breakdown: HealthScoreBreakdownRow[];
  domains: BusinessHealthDomain[];
  history: HealthHistoryPoint[];
  benchmark: {
    cohortLabel: string;
    similarStoreCount: number;
    rows: BenchmarkRow[];
  } | null;
  riskDistribution: RiskDistribution;
  actionPlan: HealthActionItem[];
  strengths: BusinessStrength[];
  executiveDecision: ExecutiveDecision;
  riskAssessment: BusinessRiskAssessment;
};
