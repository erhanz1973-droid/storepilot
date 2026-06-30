import { getVerifiedStoreData } from "@/lib/recommendations/validation";
import { getObservationDays } from "@/lib/recommendations/intelligence/observation";
import { recordLifecycleEvent } from "@/lib/recommendations/intelligence/lifecycle";
import { insertOutcomeRecord } from "@/lib/db/outcome-records";
import type { ActionExecutionOutcome } from "@/lib/execution/types";
import type { FutureActionType } from "@/lib/insights/actions";
import type { OutcomeRecord } from "@/lib/learning/outcome-types";
import {
  actionTypeToCategory,
  captureKpisForEntity,
} from "./metrics";
import { parseImpactFromLabel } from "./outcome-measurer";

function observationMs(category: string): number {
  return getObservationDays(category) * 86400000;
}

export async function scheduleOutcomeFromExecution(input: {
  storeId: string;
  title: string;
  futureAction: FutureActionType;
  platform?: string;
  entityType?: string;
  entityId?: string;
  entityName?: string;
  decisionId?: string;
  recommendationId?: string;
  opportunityKey?: string;
  actionExecutionId?: string;
  execution?: ActionExecutionOutcome | null;
  expectedImpactLabel?: string;
}): Promise<OutcomeRecord | null> {
  if (!input.execution?.success) return null;
  if (!input.execution.executed && input.execution.status === "ready") return null;

  const category = actionTypeToCategory(input.futureAction);
  const windowDays = getObservationDays(category);
  const now = new Date();
  const measureDueAt = new Date(now.getTime() + observationMs(category)).toISOString();
  const { snapshot } = await getVerifiedStoreData(input.storeId);
  const baselineMetrics = captureKpisForEntity(
    snapshot,
    input.entityType,
    input.entityId,
  );

  const record = await insertOutcomeRecord({
    storeId: input.storeId,
    recommendationId: input.recommendationId,
    actionExecutionId: input.actionExecutionId ?? input.execution.logId,
    opportunityKey: input.opportunityKey,
    decisionId: input.decisionId,
    title: input.title,
    category,
    actionType: input.futureAction,
    entityType: input.entityType,
    entityId: input.entityId,
    entityName: input.entityName,
    baselineCapturedAt: now.toISOString(),
    measureDueAt,
    measurementWindowDays: windowDays,
    expectedMonthlyImpact: parseImpactFromLabel(input.expectedImpactLabel ?? "0"),
    baselineMetrics,
  });

  if (input.recommendationId) {
    await recordLifecycleEvent({
      storeId: input.storeId,
      recommendationId: input.recommendationId,
      eventType: "executed",
      detail: input.title,
      stage: "executed",
    });
    await recordLifecycleEvent({
      storeId: input.storeId,
      recommendationId: input.recommendationId,
      eventType: "observation_started",
      detail: `Observation period: ${windowDays} days`,
      stage: "observing",
      metadata: { measureDueAt, windowDays },
    });
  }

  return record;
}

export async function scheduleOutcomeFromRecommendation(input: {
  storeId: string;
  recommendationId: string;
  title: string;
  category: string;
  entityType?: string;
  entityId?: string;
  expectedMonthlyImpact: number;
  baselineMetrics: import("@/lib/types").MeasurementKpis;
}): Promise<OutcomeRecord> {
  const now = new Date();
  const windowDays = getObservationDays(input.category);
  const measureDueAt = new Date(now.getTime() + observationMs(input.category)).toISOString();

  const record = await insertOutcomeRecord({
    storeId: input.storeId,
    recommendationId: input.recommendationId,
    title: input.title,
    category: input.category,
    entityType: input.entityType,
    entityId: input.entityId,
    baselineCapturedAt: now.toISOString(),
    measureDueAt,
    measurementWindowDays: windowDays,
    expectedMonthlyImpact: input.expectedMonthlyImpact,
    baselineMetrics: input.baselineMetrics,
  });

  await recordLifecycleEvent({
    storeId: input.storeId,
    recommendationId: input.recommendationId,
    eventType: "observation_started",
    detail: `Observation period: ${windowDays} days`,
    stage: "observing",
    metadata: { measureDueAt, windowDays },
  });

  return record;
}
