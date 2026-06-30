/** Client-safe executive summary for Simulation Lab — no server imports. */

export type SimulationProblemItem = {
  title: string;
  description: string;
  severity: "critical" | "high" | "medium" | "low";
};

export type SimulationRecommendationItem = {
  title: string;
  description: string;
  expectedMonthlyImpact: number;
  confidencePct: number;
  actionLabel: string;
};

export type SimulationExecutiveSummary = {
  storeId: string;
  storeLabel: string;
  scenarioId: string;
  scenarioLabel: string;
  generatedAt: string;
  healthScore: number;
  healthLabel: string;
  headline: string;
  narrative: string;
  criticalIssueCount: number;
  topProblems: SimulationProblemItem[];
  topRecommendations: SimulationRecommendationItem[];
  estimatedMonthlyLoss: number;
  estimatedMonthlyRecovery: number;
  topRecommendationTitle: string | null;
  confidencePct: number;
  revenue30d: number;
  netProfit30d: number;
  blendedRoas: number | null;
};
