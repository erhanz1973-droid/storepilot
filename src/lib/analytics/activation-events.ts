import type { AlphaFunnelEvent } from "@/lib/analytics/alpha-funnel";
import type { FirstRunAnalyzeResult } from "@/lib/first-run/types";

/** Canonical activation funnel — reuse existing names where they already exist. */
export const ACTIVATION_EVENTS = {
  installationCompleted: "installation_completed",
  oauthCompleted: "oauth_completed",
  shopifyConnected: "shopify_connected",
  firstRunStarted: "first_run_started",
  firstRunOpened: "first_run_opened",
  firstRunCompleted: "first_run_completed",
  firstRecommendationGenerated: "first_recommendation_generated",
  firstRecommendationShown: "first_recommendation_shown",
  firstRecommendationClicked: "first_recommendation_clicked",
  appOpened: "app_opened",
  dashboardViewed: "dashboard_viewed",
  recommendationViewed: "recommendation_viewed",
  recommendationClicked: "recommendation_clicked",
  storeStageDetected: "store_stage_detected",
  growthChecklistViewed: "growth_checklist_viewed",
  growthTaskViewed: "growth_task_viewed",
  nextBestActionShown: "next_best_action_shown",
  nextBestActionClicked: "next_best_action_clicked",
} as const;

export type ActivationTrackPayload = {
  source: string;
  timestamp: string;
  shop?: string;
  recommendation_id?: string;
  recommendation_type?: string;
};

export function activationTrackPayload(input: {
  source: string;
  shop?: string | null;
  recommendationId?: string | null;
  recommendationType?: string | null;
}): ActivationTrackPayload {
  const payload: ActivationTrackPayload = {
    source: input.source,
    timestamp: new Date().toISOString(),
  };
  if (input.shop) payload.shop = input.shop;
  if (input.recommendationId) payload.recommendation_id = input.recommendationId;
  if (input.recommendationType) payload.recommendation_type = input.recommendationType;
  return payload;
}

export function generatedEventsForAnalyzeResult(
  result: FirstRunAnalyzeResult,
): Array<{ event: AlphaFunnelEvent | string; props: ActivationTrackPayload }> {
  const events: Array<{ event: AlphaFunnelEvent | string; props: ActivationTrackPayload }> = [];
  if (result.merchantStage) {
    events.push({
      event: ACTIVATION_EVENTS.storeStageDetected,
      props: activationTrackPayload({
        source: "first_run",
        recommendationType: result.merchantStage,
      }),
    });
  }
  if (result.decision) {
    const props = activationTrackPayload({
      source: "first_run",
      recommendationId: result.decision.recommendationId,
      recommendationType: result.decision.recommendationType,
    });
    events.push(
      { event: ACTIVATION_EVENTS.firstRecommendationGenerated, props },
      { event: ACTIVATION_EVENTS.firstRecommendationShown, props },
      { event: ACTIVATION_EVENTS.nextBestActionShown, props },
    );
    return events;
  }
  if (result.firstValue) {
    const props = activationTrackPayload({
      source: "first_run",
      recommendationType: result.firstValue.recommendationType,
    });
    events.push(
      { event: ACTIVATION_EVENTS.nextBestActionShown, props },
      { event: ACTIVATION_EVENTS.firstRecommendationShown, props },
    );
  }
  return events;
}
