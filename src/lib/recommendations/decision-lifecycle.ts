import type { RecommendationStatus } from "@/lib/types";

/** Executive decision track — richer than approval lifecycle stepper */
export const DECISION_TRACK_STAGES = [
  { key: "draft", label: "Draft" },
  { key: "pending_review", label: "Pending Review" },
  { key: "approved", label: "Approved" },
  { key: "executing", label: "Executing" },
  { key: "measuring", label: "Measuring Impact" },
  { key: "completed", label: "Completed" },
] as const;

export type DecisionTrackStage = (typeof DECISION_TRACK_STAGES)[number]["key"];

export function toDecisionTrackStage(status: RecommendationStatus): DecisionTrackStage {
  switch (status) {
    case "pending":
    case "snoozed":
      return "pending_review";
    case "approved":
      return "approved";
    case "implemented":
      return "measuring";
    case "measured":
    case "completed":
      return "completed";
    case "ignored":
      return "draft";
    default:
      return "pending_review";
  }
}

export function decisionTrackIndex(status: RecommendationStatus): number {
  const stage = toDecisionTrackStage(status);
  return DECISION_TRACK_STAGES.findIndex((s) => s.key === stage);
}
