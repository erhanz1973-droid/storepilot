import type { AnalyzerOutput } from "@/lib/types";
import {
  insertLifecycleEvent,
  updateRecommendationLifecycle,
} from "@/lib/db/recommendation-intelligence";
import type { LifecycleEventType, LifecycleStage } from "./types";

const EVENT_LABELS: Record<LifecycleEventType, string> = {
  created: "Recommendation Created",
  displayed: "Displayed to Merchant",
  approved: "Merchant Approved",
  rejected: "Merchant Rejected",
  snoozed: "Deferred for Later",
  executed: "Action Executed",
  observation_started: "Observation Period Started",
  outcome_measured: "Outcome Measured",
  closed: "Recommendation Closed",
  expired: "Recommendation Expired",
};

export async function recordLifecycleEvent(input: {
  storeId: string;
  recommendationId: string;
  eventType: LifecycleEventType;
  detail?: string;
  metadata?: Record<string, unknown>;
  stage?: LifecycleStage;
}): Promise<void> {
  await insertLifecycleEvent({
    recommendationId: input.recommendationId,
    storeId: input.storeId,
    eventType: input.eventType,
    label: EVENT_LABELS[input.eventType],
    detail: input.detail,
    metadata: input.metadata,
  });

  if (input.stage) {
    await updateRecommendationLifecycle(input.recommendationId, input.stage);
  }
}

export async function onRecommendationsCreated(
  storeId: string,
  outputs: AnalyzerOutput[],
  idByDedupe: Map<string, string>,
): Promise<void> {
  for (const output of outputs) {
    const recId = idByDedupe.get(output.id);
    if (!recId) continue;
    await recordLifecycleEvent({
      storeId,
      recommendationId: recId,
      eventType: "created",
      detail: output.title,
      stage: "created",
      metadata: { category: output.category, confidence: output.confidence },
    });
  }
}

export async function markRecommendationsDisplayed(
  storeId: string,
  recommendationIds: string[],
): Promise<void> {
  for (const id of recommendationIds) {
    await recordLifecycleEvent({
      storeId,
      recommendationId: id,
      eventType: "displayed",
      stage: "displayed",
    });
  }
}
