import type { OutcomeRecord } from "@/lib/learning/outcome-types";
import type { Recommendation } from "@/lib/types";
import {
  insertLearningRecord,
  saveOutcomeMetrics,
} from "@/lib/db/recommendation-intelligence";
import { recordLifecycleEvent } from "./lifecycle";
import { getObservationDays } from "./observation";

function num(v: unknown): number | undefined {
  if (v == null) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/** Complete outcome pipeline: metrics + learning record + lifecycle close. */
export async function finalizeRecommendationOutcome(input: {
  storeId: string;
  recommendation: Recommendation;
  outcomeRecord?: OutcomeRecord;
  approved: boolean;
  validationScore?: number;
  evidence?: unknown[];
}): Promise<void> {
  const { recommendation: rec, outcomeRecord } = input;
  const baseline = outcomeRecord?.baselineMetrics ?? rec.baselineMetrics ?? {};
  const outcome = outcomeRecord?.outcomeMetrics ?? rec.outcomeMetrics ?? {};
  const observationDays =
    outcomeRecord?.measurementWindowDays ?? getObservationDays(rec.category);

  const revenueBefore = num(baseline.revenue7d ?? baseline.revenue30d);
  const revenueAfter = num(outcome.revenue7d ?? outcome.revenue30d);
  const roasBefore = num(baseline.roas7d);
  const roasAfter = num(outcome.roas7d);
  const conversionBefore = num(baseline.conversionRate30d);
  const conversionAfter = num(outcome.conversionRate30d);

  const success =
    outcomeRecord?.outcomeRating === "successful" ||
    (revenueAfter != null && revenueBefore != null && revenueAfter > revenueBefore);

  const metrics = await saveOutcomeMetrics({
    storeId: input.storeId,
    recommendationId: rec.id,
    outcomeRecordId: outcomeRecord?.id,
    measurementStart: outcomeRecord?.baselineCapturedAt ?? rec.implementedAt ?? rec.createdAt,
    measurementEnd: outcomeRecord?.measuredAt ?? new Date().toISOString(),
    observationDays,
    revenueBefore,
    revenueAfter,
    roasBefore,
    roasAfter,
    conversionBefore,
    conversionAfter,
    aovBefore: num(baseline.aov30d),
    aovAfter: num(outcome.aov30d),
    success,
    notes: outcomeRecord?.outcomeSummary ?? rec.outcomeSummary ?? undefined,
  });

  await insertLearningRecord({
    storeId: input.storeId,
    recommendationId: rec.id,
    category: rec.category,
    confidence: rec.confidenceScore,
    validationScore: input.validationScore,
    approved: input.approved,
    successful: success,
    revenueImpactPct: metrics.revenueDeltaPct,
    roasImpactPct: metrics.roasDeltaPct,
    observationDays,
    evidence: input.evidence ?? [],
  });

  await recordLifecycleEvent({
    storeId: input.storeId,
    recommendationId: rec.id,
    eventType: "outcome_measured",
    detail: success ? "Recommendation Successful" : "Outcome needs review",
    stage: "measured",
    metadata: {
      revenueDeltaPct: metrics.revenueDeltaPct,
      roasDeltaPct: metrics.roasDeltaPct,
    },
  });

  await recordLifecycleEvent({
    storeId: input.storeId,
    recommendationId: rec.id,
    eventType: "closed",
    detail: success ? "Recommendation closed — positive outcome" : "Recommendation closed",
    stage: "closed",
  });
}
