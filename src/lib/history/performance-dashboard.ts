import type { OutcomeRecord } from "@/lib/learning/outcome-types";
import { outcomeRatingLabel } from "@/lib/learning/outcome-scorer";
import { parseRevenueImpact } from "@/lib/approvals/revenue";
import type { RecommendationHistoryEntry, RecommendationStatus } from "@/lib/types";
import {
  businessAreaLabel,
  categoryToBusinessArea,
  type BusinessAreaId,
} from "./business-areas";
import { historyLifecycleIndex } from "./lifecycle";

export type AiPerformanceSummaryStats = {
  generated: number;
  approved: number;
  rejected: number;
  expired: number;
  averageConfidencePct: number;
  improvedProfitPct: number;
  totalEstimatedMonthlyImpact: number;
  actualMeasuredImprovement: number;
  aiAccuracyPct: number;
};

export type RecommendationQualityGrade = "excellent" | "good" | "needs_improvement" | "pending";

export type PerformanceHistoryRow = {
  entry: RecommendationHistoryEntry;
  businessArea: BusinessAreaId;
  businessAreaLabel: string;
  lifecycleIndex: number;
  merchantDecision: string;
  statusLabel: string;
  expectedMonthlyProfit: number;
  actualMonthlyProfit: number | null;
  forecastAccuracyPct: number | null;
  measurementWindowDays: number | null;
  outcomeLabel: string;
  qualityGrade: RecommendationQualityGrade;
  qualityLabel: string;
  learningFeedback: string | null;
  outcome: OutcomeRecord | null;
  metricDeltas: { label: string; before: string; after: string }[];
};

export type PerformanceDashboardView = {
  summary: AiPerformanceSummaryStats;
  rows: PerformanceHistoryRow[];
  hasMeasuredOutcomes: boolean;
  visionStatement: string;
};

const EXPIRE_DAYS = 30;

function isExpired(entry: RecommendationHistoryEntry, now: number): boolean {
  if (entry.status !== "pending" && entry.status !== "snoozed") return false;
  const created = new Date(entry.createdAt).getTime();
  return now - created > EXPIRE_DAYS * 86400000;
}

function merchantDecisionLabel(status: RecommendationStatus): string {
  switch (status) {
    case "approved":
      return "Approved";
    case "ignored":
      return "Rejected";
    case "implemented":
      return "Executed";
    case "measured":
    case "completed":
      return "Completed";
    case "snoozed":
      return "Snoozed";
    default:
      return "Pending";
  }
}

function statusDisplayLabel(status: RecommendationStatus): string {
  switch (status) {
    case "pending":
      return "Pending Review";
    case "approved":
      return "Approved";
    case "implemented":
      return "Monitoring";
    case "measured":
      return "Measured";
    case "completed":
      return "Completed";
    case "ignored":
      return "Rejected";
    case "snoozed":
      return "Snoozed";
    default:
      return status;
  }
}

function qualityFromOutcome(
  outcome: OutcomeRecord | null,
  accuracy: number | null,
): { grade: RecommendationQualityGrade; label: string; reason: string | null } {
  if (!outcome || outcome.measureStatus !== "completed") {
    return { grade: "pending", label: "Awaiting Measurement", reason: null };
  }

  const acc = accuracy ?? outcome.predictionAccuracy ?? 0;

  if (outcome.outcomeRating === "successful" && acc >= 85) {
    return { grade: "excellent", label: "Excellent", reason: null };
  }
  if (outcome.outcomeRating === "needs_improvement" || acc < 55) {
    return {
      grade: "needs_improvement",
      label: "Needs Improvement",
      reason:
        outcome.failureReason ??
        outcome.outcomeSummary ??
        "Prediction diverged from actual business results.",
    };
  }
  if (acc >= 70) {
    return { grade: "good", label: "Good", reason: null };
  }
  return { grade: "needs_improvement", label: "Needs Improvement", reason: outcome.outcomeSummary };
}

function buildLearningFeedback(
  entry: RecommendationHistoryEntry,
  outcome: OutcomeRecord | null,
  accuracy: number | null,
): string | null {
  if (outcome?.aiVerdict) {
    const base = outcome.aiVerdict;
    if (outcome.outcomeRating === "successful" && (accuracy ?? 0) >= 85) {
      return `${base} StorePilot has increased confidence in similar recommendations for ${businessAreaLabel(categoryToBusinessArea(entry.recommendation.category)).toLowerCase()} actions.`;
    }
    if (outcome.outcomeRating === "needs_improvement") {
      return `${base} Future recommendations will require stronger evidence before suggesting similar actions.`;
    }
    return base;
  }

  if (!outcome || outcome.measureStatus !== "completed") return null;

  const acc = accuracy ?? 0;
  const area = businessAreaLabel(categoryToBusinessArea(entry.recommendation.category));

  if (acc >= 90) {
    return `This recommendation performed better than expected. StorePilot has increased confidence in similar recommendations for ${area.toLowerCase()} actions.`;
  }
  if (acc < 55) {
    return `This recommendation underperformed expectations. Future ${area.toLowerCase()} recommendations will require stronger evidence before approval.`;
  }
  return `Outcome aligned with expectations. StorePilot will continue refining ${area.toLowerCase()} models with this data point.`;
}

function buildMetricDeltas(outcome: OutcomeRecord | null): { label: string; before: string; after: string }[] {
  if (!outcome?.kpiDeltas?.length) return [];
  return outcome.kpiDeltas.slice(0, 6).map((d) => ({
    label: d.label,
    before: d.before,
    after: d.after,
  }));
}

function outcomeLabel(outcome: OutcomeRecord | null, status: RecommendationStatus): string {
  if (outcome?.measureStatus === "completed" && outcome.outcomeRating) {
    return outcomeRatingLabel(outcome.outcomeRating);
  }
  if (status === "implemented") return "Measuring";
  if (status === "approved") return "Awaiting Execution";
  if (status === "ignored") return "Not Executed";
  if (status === "pending") return "Awaiting Decision";
  return "—";
}

export function buildPerformanceSummary(
  entries: RecommendationHistoryEntry[],
  outcomes: OutcomeRecord[],
  now = Date.now(),
): AiPerformanceSummaryStats {
  const generated = entries.length;
  const approved = entries.filter((e) =>
    ["approved", "implemented", "measured", "completed"].includes(e.status),
  ).length;
  const rejected = entries.filter((e) => e.status === "ignored").length;
  const expired = entries.filter((e) => isExpired(e, now)).length;

  const avgConfidence =
    generated > 0
      ? Math.round(
          (entries.reduce((s, e) => s + e.confidenceScore, 0) / generated) * 100,
        )
      : 0;

  const completedOutcomes = outcomes.filter((o) => o.measureStatus === "completed");
  const improvedCount = completedOutcomes.filter(
    (o) => (o.actualMonthlyImpact ?? 0) > 0 || o.outcomeRating === "successful",
  ).length;
  const improvedProfitPct =
    completedOutcomes.length > 0
      ? Math.round((improvedCount / completedOutcomes.length) * 100)
      : 0;

  const totalEstimated = entries
    .filter((e) => ["approved", "implemented", "measured", "completed"].includes(e.status))
    .reduce((s, e) => s + parseRevenueImpact(e.expectedImpact), 0);

  const actualMeasured = completedOutcomes.reduce(
    (s, o) => s + (o.actualMonthlyImpact ?? 0),
    0,
  );

  const accuracies = completedOutcomes
    .map((o) => o.predictionAccuracy)
    .filter((a): a is number => a != null);
  const aiAccuracyPct =
    accuracies.length > 0
      ? Math.round(accuracies.reduce((s, a) => s + a, 0) / accuracies.length)
      : avgConfidence;

  return {
    generated,
    approved,
    rejected,
    expired,
    averageConfidencePct: avgConfidence,
    improvedProfitPct,
    totalEstimatedMonthlyImpact: totalEstimated,
    actualMeasuredImprovement: actualMeasured,
    aiAccuracyPct,
  };
}

export function buildPerformanceRow(
  entry: RecommendationHistoryEntry,
  outcomeMap: Map<string, OutcomeRecord>,
): PerformanceHistoryRow {
  const outcome = outcomeMap.get(entry.recommendationId) ?? null;
  const outcomeComplete = outcome?.measureStatus === "completed";
  const area = categoryToBusinessArea(entry.recommendation.category);
  const expectedMonthly = parseRevenueImpact(entry.expectedImpact);
  const actualMonthly =
    outcome?.actualMonthlyImpact ??
    (entry.recommendation.actualImpact
      ? parseRevenueImpact(entry.recommendation.actualImpact)
      : null);
  const accuracy =
    outcome?.predictionAccuracy ??
    entry.recommendation.predictionAccuracy ??
    null;

  const quality = qualityFromOutcome(outcome, accuracy);

  return {
    entry,
    businessArea: area,
    businessAreaLabel: businessAreaLabel(area),
    lifecycleIndex: historyLifecycleIndex(entry.status, Boolean(outcome), Boolean(outcomeComplete)),
    merchantDecision: merchantDecisionLabel(entry.status),
    statusLabel: statusDisplayLabel(entry.status),
    expectedMonthlyProfit: expectedMonthly,
    actualMonthlyProfit: actualMonthly,
    forecastAccuracyPct: accuracy,
    measurementWindowDays:
      outcome?.measurementWindowDays ?? entry.recommendation.measurementWindowDays ?? null,
    outcomeLabel: outcomeLabel(outcome, entry.status),
    qualityGrade: quality.grade,
    qualityLabel: quality.label,
    learningFeedback: buildLearningFeedback(entry, outcome, accuracy),
    outcome,
    metricDeltas: buildMetricDeltas(outcome),
  };
}

export function buildPerformanceDashboard(
  entries: RecommendationHistoryEntry[],
  outcomes: OutcomeRecord[],
): PerformanceDashboardView {
  const outcomeMap = new Map<string, OutcomeRecord>();
  for (const o of outcomes) {
    if (o.recommendationId) outcomeMap.set(o.recommendationId, o);
  }

  const rows = entries.map((e) => buildPerformanceRow(e, outcomeMap));
  const hasMeasuredOutcomes = outcomes.some((o) => o.measureStatus === "completed");

  return {
    summary: buildPerformanceSummary(entries, outcomes),
    rows,
    hasMeasuredOutcomes,
    visionStatement:
      "Recommendation History is StorePilot's AI memory — every decision is measured, validated, and used to improve future recommendations.",
  };
}
