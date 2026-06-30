import type { RecommendationStatus } from "@/lib/types";

export const LIFECYCLE_STAGES = [
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "implemented", label: "Implemented" },
  { key: "measured", label: "Measured" },
] as const;

export type LifecycleStage = (typeof LIFECYCLE_STAGES)[number]["key"];

export function resolveRecommendationStatus(
  recommendation: { status?: RecommendationStatus },
  approvalStatus?: RecommendationStatus,
): RecommendationStatus {
  return approvalStatus ?? recommendation.status ?? "pending";
}

export function lifecycleStageIndex(status: RecommendationStatus): number {
  const stage = toLifecycleStage(status);
  return LIFECYCLE_STAGES.findIndex((s) => s.key === stage);
}

/** Map terminal / off-path statuses onto the nearest lifecycle step for display */
export function toLifecycleStage(status: RecommendationStatus): LifecycleStage {
  switch (status) {
    case "approved":
      return "approved";
    case "implemented":
    case "completed":
      return "implemented";
    case "measured":
      return "measured";
    case "ignored":
    case "snoozed":
      return "pending";
    default:
      return "pending";
  }
}

export function lifecycleStatusLabel(status: RecommendationStatus, locale: "en" | "tr" = "en"): string {
  if (locale === "tr") {
    switch (status) {
      case "pending":
        return "Beklemede";
      case "approved":
        return "Onaylandı";
      case "implemented":
        return "Uygulandı";
      case "completed":
        return "Tamamlandı";
      case "measured":
        return "Ölçüldü";
      case "ignored":
        return "Reddedildi";
      case "snoozed":
        return "Ertelendi";
      default:
        return status;
    }
  }

  switch (status) {
    case "pending":
      return "Pending";
    case "approved":
      return "Approved";
    case "implemented":
      return "Implemented";
    case "completed":
      return "Completed";
    case "measured":
      return "Measured";
    case "ignored":
      return "Ignored";
    case "snoozed":
      return "Snoozed";
    default:
      return status;
  }
}

export function measurementDaysRemaining(
  implementedAt: string | undefined,
  windowDays = 7,
  now = Date.now(),
): number | null {
  if (!implementedAt) return null;
  const due = new Date(implementedAt).getTime() + windowDays * 86400000;
  const remaining = Math.ceil((due - now) / 86400000);
  return Math.max(0, remaining);
}
