import { aggregateStoreSnapshot } from "@/lib/connectors/registry";
import { updateOutcomeRecord } from "@/lib/db/outcome-records";
import type { OutcomeRecord } from "@/lib/learning/outcome-types";
import {
  actionTypeToCategory,
  buildAiVerdict,
  buildOutcomeSummary,
  captureKpisForEntity,
  compareKpisForAction,
  estimateActualMonthlyImpact,
  computePredictionAccuracy,
} from "./metrics";
import { getMeasurementWindowDays } from "./measurement";
import { scoreOutcome } from "./outcome-scorer";

export function isOutcomeReadyForMeasurement(record: OutcomeRecord, now = new Date()): boolean {
  if (record.measureStatus !== "scheduled") return false;
  return now.getTime() >= new Date(record.measureDueAt).getTime();
}

export async function measureOutcomeRecord(
  record: OutcomeRecord,
  snapshot?: Awaited<ReturnType<typeof aggregateStoreSnapshot>>,
  now = new Date(),
): Promise<OutcomeRecord | null> {
  if (!isOutcomeReadyForMeasurement(record, now)) return null;

  const storeSnapshot = snapshot ?? (await aggregateStoreSnapshot(record.storeId));
  const outcomeMetrics = captureKpisForEntity(
    storeSnapshot,
    record.entityType,
    record.entityId,
  );

  const category = actionTypeToCategory(record.actionType);
  const deltas = compareKpisForAction(
    record.actionType,
    category,
    record.baselineMetrics,
    outcomeMetrics,
  );

  const actualMonthly = estimateActualMonthlyImpact(
    category,
    record.baselineMetrics,
    outcomeMetrics,
  );
  const predictionAccuracy = computePredictionAccuracy(
    record.expectedMonthlyImpact,
    actualMonthly,
  );
  const outcomeSummary = buildOutcomeSummary(category, deltas);
  const scored = scoreOutcome({
    predictionAccuracy,
    deltas,
    actualMonthly,
    expectedMonthly: record.expectedMonthlyImpact,
  });
  const aiVerdict = buildAiVerdict({
    actionType: record.actionType,
    rating: scored.rating,
    deltas,
    entityName: record.entityName,
  });

  return updateOutcomeRecord(record.id, {
    measureStatus: "completed",
    measuredAt: now.toISOString(),
    actualMonthlyImpact: actualMonthly,
    predictionAccuracy,
    outcomeRating: scored.rating,
    confidenceLabel: scored.confidenceLabel,
    outcomeMetrics,
    kpiDeltas: deltas,
    outcomeSummary,
    aiVerdict,
    scoreBreakdown: scored.breakdown,
  });
}

export function parseImpactFromLabel(label: string): number {
  const match = label.match(/\$?([\d,]+)/);
  if (!match) return 0;
  return Number(match[1].replace(/,/g, "")) || 0;
}
