import { parseRevenueImpact } from "@/lib/approvals/presenter";
import type { StoreSnapshot } from "@/lib/connectors/types";
import {
  buildOutcomeSummary,
  captureKpisForRecommendation,
  compareKpis,
  computePredictionAccuracy,
  estimateActualMonthlyImpact,
} from "./metrics";
import type { Recommendation, RecommendationOutcome } from "@/lib/types";

export function getMeasurementWindowDays(): number {
  const env = process.env.MEASUREMENT_WINDOW_DAYS;
  if (env) {
    const parsed = Number(env);
    if (!Number.isNaN(parsed) && parsed > 0) return parsed;
  }
  return 7;
}

/** Dev override: hours instead of days for faster testing */
export function getMeasurementWindowMs(): number {
  const hours = process.env.MEASUREMENT_WINDOW_HOURS;
  if (hours) {
    const parsed = Number(hours);
    if (!Number.isNaN(parsed) && parsed > 0) return parsed * 3600000;
  }
  return getMeasurementWindowDays() * 86400000;
}

export function isReadyForMeasurement(rec: Recommendation, now = new Date()): boolean {
  if (rec.status !== "implemented" || !rec.implementedAt) return false;
  const dueAt = new Date(rec.implementedAt).getTime() + getMeasurementWindowMs();
  return now.getTime() >= dueAt;
}

export function measureRecommendation(
  rec: Recommendation,
  snapshot: StoreSnapshot,
  now = new Date(),
): RecommendationOutcome | null {
  if (!rec.baselineMetrics) return null;

  const outcomeMetrics = captureKpisForRecommendation(snapshot, rec);
  const deltas = compareKpis(rec.category, rec.baselineMetrics, outcomeMetrics);
  const expectedMonthly = parseRevenueImpact(rec.expectedImpact);
  const actualMonthly = estimateActualMonthlyImpact(
    rec.category,
    rec.baselineMetrics,
    outcomeMetrics,
  );
  const predictionAccuracy = computePredictionAccuracy(expectedMonthly, actualMonthly);
  const outcomeSummary = buildOutcomeSummary(rec.category, deltas);

  return {
    expectedMonthlyImpact: expectedMonthly,
    actualMonthlyImpact: actualMonthly,
    predictionAccuracy,
    baselineMetrics: rec.baselineMetrics,
    outcomeMetrics,
    outcomeSummary,
    measurementWindowDays: rec.measurementWindowDays ?? getMeasurementWindowDays(),
    measuredAt: now.toISOString(),
  };
}

export function formatActualImpact(monthly: number): string {
  const sign = monthly >= 0 ? "+" : "";
  return `${sign}$${monthly.toLocaleString(undefined, { maximumFractionDigits: 0 })}/month`;
}

export function formatAccuracy(pct: number): string {
  return `${pct}%`;
}
