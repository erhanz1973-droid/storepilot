import type { KpiDelta } from "./metrics";
import type { MeasurementKpis, RecommendationCategory } from "@/lib/types";

export type OutcomeRating = "successful" | "neutral" | "needs_improvement";

export type OutcomeMeasureStatus = "scheduled" | "completed" | "failed" | "skipped";

export type OutcomeDisplayMetric = {
  label: string;
  value: string;
  trend?: "up" | "down" | "neutral";
};

export type OutcomeRecord = {
  id: string;
  storeId: string;
  recommendationId: string | null;
  actionExecutionId: string | null;
  opportunityKey: string | null;
  decisionId: string | null;
  title: string;
  category: RecommendationCategory | string;
  actionType: string | null;
  entityType: string | null;
  entityId: string | null;
  entityName: string | null;
  baselineCapturedAt: string;
  measureDueAt: string;
  measuredAt: string | null;
  measurementWindowDays: number;
  measureStatus: OutcomeMeasureStatus;
  expectedMonthlyImpact: number;
  actualMonthlyImpact: number | null;
  predictionAccuracy: number | null;
  outcomeRating: OutcomeRating | null;
  confidenceLabel: string | null;
  baselineMetrics: MeasurementKpis;
  outcomeMetrics: MeasurementKpis | null;
  kpiDeltas: KpiDelta[] | null;
  outcomeSummary: string | null;
  aiVerdict: string | null;
  scoreBreakdown: Record<string, unknown>;
  failureReason: string | null;
};

export type OutcomeRecordSummary = Pick<
  OutcomeRecord,
  | "id"
  | "measureStatus"
  | "measureDueAt"
  | "measuredAt"
  | "measurementWindowDays"
  | "outcomeRating"
  | "outcomeSummary"
  | "aiVerdict"
  | "confidenceLabel"
  | "predictionAccuracy"
  | "actualMonthlyImpact"
  | "expectedMonthlyImpact"
  | "kpiDeltas"
  | "title"
  | "actionType"
>;
