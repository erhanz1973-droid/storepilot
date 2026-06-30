import { getVerifiedStoreData } from "@/lib/recommendations/validation";
import { finalizeRecommendationOutcome } from "@/lib/recommendations/intelligence/outcome-pipeline";
import { getLatestAuditByRecommendationId } from "@/lib/recommendations/validation/audit";
import {
  getRecommendationById,
  listStoredRecommendations,
  markRecommendationImplemented,
  saveRecommendationOutcome,
  updateRecommendationWithOutcome,
} from "@/lib/db/learning";
import { listScheduledOutcomeRecords } from "@/lib/db/outcome-records";
import { parseRevenueImpact } from "@/lib/approvals/presenter";
import { captureKpisForRecommendation } from "./metrics";
import { formatActualImpact, isReadyForMeasurement, measureRecommendation } from "./measurement";
import { isOutcomeReadyForMeasurement, measureOutcomeRecord } from "./outcome-measurer";
import { scheduleOutcomeFromRecommendation } from "./outcome-scheduler";
import type { Recommendation } from "@/lib/types";
import { DEMO_STORE_ID } from "@/lib/types";
import type { OutcomeRecord } from "./outcome-types";

export type MeasurementRunResult = {
  processed: number;
  measured: Recommendation[];
  outcomeRecordsMeasured: OutcomeRecord[];
  skipped: number;
};

export async function runPendingOutcomeMeasurements(
  storeId = DEMO_STORE_ID,
): Promise<{ measured: OutcomeRecord[]; skipped: number }> {
  const { snapshot } = await getVerifiedStoreData(storeId);
  const scheduled = await listScheduledOutcomeRecords(storeId);
  const measured: OutcomeRecord[] = [];
  let skipped = 0;

  for (const record of scheduled) {
    if (!isOutcomeReadyForMeasurement(record)) {
      skipped += 1;
      continue;
    }
    const result = await measureOutcomeRecord(record, snapshot);
    if (result) {
      measured.push(result);
      if (result.recommendationId) {
        const rec = await getRecommendationById(result.recommendationId);
        const audit = await getLatestAuditByRecommendationId(storeId, result.recommendationId);
        if (rec) {
          await finalizeRecommendationOutcome({
            storeId,
            recommendation: rec,
            outcomeRecord: result,
            approved: true,
            validationScore: audit?.validationScore ?? undefined,
            evidence: audit?.evidence,
          });
        }
      }
    } else skipped += 1;
  }

  return { measured, skipped };
}

export async function runPendingMeasurements(
  storeId = DEMO_STORE_ID,
): Promise<MeasurementRunResult> {
  const { snapshot } = await getVerifiedStoreData(storeId);
  const allRecs = await listStoredRecommendations(storeId);
  const implemented = allRecs.filter((r) => r.status === "implemented");
  const measured: Recommendation[] = [];
  let skipped = 0;

  for (const rec of implemented) {
    if (!isReadyForMeasurement(rec)) {
      skipped += 1;
      continue;
    }

    const outcome = measureRecommendation(rec, snapshot);
    if (!outcome) {
      skipped += 1;
      continue;
    }

    const updated = await updateRecommendationWithOutcome(rec.id, {
      status: "measured",
      actualImpact: formatActualImpact(outcome.actualMonthlyImpact),
      predictionAccuracy: outcome.predictionAccuracy,
      measuredAt: outcome.measuredAt,
      outcomeMetrics: outcome.outcomeMetrics,
      outcomeSummary: outcome.outcomeSummary,
      measurementWindowDays: outcome.measurementWindowDays,
    });

    await saveRecommendationOutcome(storeId, rec, outcome);
    const audit = await getLatestAuditByRecommendationId(storeId, rec.id);
    await finalizeRecommendationOutcome({
      storeId,
      recommendation: updated,
      approved: rec.status === "approved" || rec.status === "implemented",
      validationScore: audit?.validationScore ?? undefined,
      evidence: audit?.evidence,
    });
    measured.push(updated);
  }

  const outcomeRun = await runPendingOutcomeMeasurements(storeId);

  return {
    processed: implemented.length,
    measured,
    outcomeRecordsMeasured: outcomeRun.measured,
    skipped: skipped + outcomeRun.skipped,
  };
}

export async function captureBaselineOnImplement(
  recommendationId: string,
  storeId = DEMO_STORE_ID,
): Promise<Recommendation | null> {
  const rec = await getRecommendationById(recommendationId);
  if (!rec) return null;

  const { snapshot } = await getVerifiedStoreData(storeId);
  const baselineMetrics = captureKpisForRecommendation(snapshot, rec);
  const updated = await markRecommendationImplemented(recommendationId, baselineMetrics, storeId);

  await scheduleOutcomeFromRecommendation({
    storeId,
    recommendationId,
    title: rec.title,
    category: rec.category,
    entityType: rec.entityType ?? undefined,
    entityId: rec.entityId ?? undefined,
    expectedMonthlyImpact: parseRevenueImpact(rec.expectedImpact),
    baselineMetrics,
  });

  return updated;
}
