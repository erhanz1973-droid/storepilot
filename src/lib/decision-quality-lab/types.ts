import type { BusinessModel } from "@/lib/business-model/types";
import type { SimulationRunResult } from "@/lib/simulation-lab/types";
import type { IntentMatchResult } from "./semantic-evaluator";
import type { DecisionSelfAssessment } from "./self-assessment";
import type { DecisionQualityBreakdown } from "./quality-score";
import type { DecisionQaRecord } from "@/lib/decisions/qa/types";
import type { DriftAlert } from "./drift";
import type { LeaderboardEntry } from "./leaderboard";
import type { DecisionIntent } from "./intents";

export type IntentEvaluationRecord = IntentMatchResult & {
  id: string;
  runId: string;
  storeId: string;
  scenarioId?: string;
  businessModel?: string;
  createdAt: string;
};

export type ReleaseQualityThresholds = {
  decisionAccuracyPct: number;
  businessModelCompliancePct: number;
  validationCoveragePct: number;
  criticalScenarioPassPct: number;
  decisionQualityPct: number;
};

export type QualityGateReport = {
  passed: boolean;
  productionReady: boolean;
  checks: Array<{
    id: string;
    label: string;
    threshold: number;
    actual: number;
    passed: boolean;
  }>;
  failedChecks: string[];
  message: string;
  evaluatedAt: string;
};

export type DecisionQualityRecord = {
  id: string;
  storeId: string;
  runId: string;
  scenarioId?: string;
  businessModel?: BusinessModel;
  decisionId: string;
  problemKey?: string;
  summary: string;
  category?: string;
  overallQualityPct: number;
  validationQualityPct: number;
  explainabilityPct: number;
  businessLogicPct: number;
  strategyComparisonPct: number;
  evidenceCompletenessPct: number;
  intentMatchPct: number;
  businessModelCompliancePct: number;
  confidencePct: number;
  detectedIntents: DecisionIntent[];
  selfAssessment: DecisionSelfAssessment;
  breakdown: DecisionQualityBreakdown;
  createdAt: string;
};

export type QualityRunSummary = {
  runId: string;
  runType: "simulation" | "regression" | "monte_carlo" | "replay" | "release_gate";
  releaseVersion?: string;
  scenarioId?: string;
  businessModel?: BusinessModel;
  storeId?: string;
  verdict: "pass" | "warn" | "fail";
  accuracyPct: number;
  avgQualityPct: number;
  avgConfidencePct: number;
  avgExplainabilityPct: number;
  avgValidationPct: number;
  businessModelCompliancePct: number;
  passCount: number;
  warnCount: number;
  failCount: number;
  forbiddenHits: string[];
  driftFlags: string[];
  performance: Record<string, number | boolean>;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

export type QualityBenchmarkSnapshot = {
  releaseVersion: string;
  accuracyPct: number;
  passCount: number;
  warnCount: number;
  failCount: number;
  avgConfidencePct: number;
  avgExplainabilityPct: number;
  avgValidationPct: number;
  avgQualityPct: number;
  gatePassed: boolean;
  trend: "increasing" | "decreasing" | "stable";
  createdAt: string;
};

export type EnrichedQualityRunResult = SimulationRunResult & {
  semantic: import("./semantic-evaluator").SemanticEvaluationResult;
  qualityRecords: Array<{
    decision: DecisionQaRecord;
    breakdown: DecisionQualityBreakdown;
    intents: DecisionIntent[];
    selfAssessment: DecisionSelfAssessment;
  }>;
  summary: QualityRunSummary;
  drift: DriftAlert | null;
  avgQualityPct: number;
};

export type QualityLabReport = {
  generatedAt: string;
  accuracyPct: number;
  accuracyTrend: "increasing" | "decreasing" | "stable";
  totalRuns: number;
  recentRuns: QualityRunSummary[];
  avgQualityPct: number;
  gate?: QualityGateReport;
  benchmark?: QualityBenchmarkSnapshot;
  leaderboard?: LeaderboardEntry[];
  driftAlerts?: DriftAlert[];
  performanceMs?: number;
};
