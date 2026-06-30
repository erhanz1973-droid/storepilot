import type { RecommendationStatus } from "@/lib/types";

export const HISTORY_LIFECYCLE_STAGES = [
  { key: "generated", label: "Generated" },
  { key: "approved", label: "Approved" },
  { key: "executed", label: "Executed" },
  { key: "monitoring", label: "Monitoring" },
  { key: "measured", label: "Measured" },
  { key: "completed", label: "Completed" },
] as const;

export type HistoryLifecycleStage = (typeof HISTORY_LIFECYCLE_STAGES)[number]["key"];

export function historyLifecycleIndex(
  status: RecommendationStatus,
  hasOutcome: boolean,
  outcomeComplete: boolean,
): number {
  if (status === "ignored") return 0;
  if (status === "pending" || status === "snoozed") return 0;
  if (status === "approved") return 1;
  if (status === "implemented") return 3;
  if (status === "measured" && !outcomeComplete) return 4;
  if (status === "measured" || status === "completed" || outcomeComplete) return 5;
  return 0;
}

export function historyLifecycleStage(
  status: RecommendationStatus,
  hasOutcome: boolean,
  outcomeComplete: boolean,
): HistoryLifecycleStage {
  const idx = historyLifecycleIndex(status, hasOutcome, outcomeComplete);
  return HISTORY_LIFECYCLE_STAGES[Math.min(idx, HISTORY_LIFECYCLE_STAGES.length - 1)]!.key;
}
