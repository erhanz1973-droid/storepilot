export type BusinessHealthStatus = "healthy" | "warning" | "critical" | "limited";

export type DomainTrend = {
  windowLabel: "30-Day Trend" | "7-Day Trend";
  direction: "improving" | "declining" | "stable";
  label: string;
  deltaPoints: number | null;
};

export type BusinessHealthDomain = {
  id: string;
  label: string;
  score: number;
  status: BusinessHealthStatus;
  why: string;
  recommendedAction: string;
  estimatedImpact: string | null;
  estimatedImpactMonthly: number | null;
  trend: DomainTrend;
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
};

export type HealthScoreBreakdownRow = {
  id: string;
  label: string;
  score: number;
};

export type HealthHistoryPoint = {
  date: string;
  score: number;
};

export type BenchmarkRow = {
  id: string;
  label: string;
  percentile: number;
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
  category: string;
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
};
