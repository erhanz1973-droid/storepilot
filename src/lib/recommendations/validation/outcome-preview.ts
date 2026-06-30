import type { RecommendationAuditRecord } from "./types";

/** Preview outcome state for UI (full measurement wired via outcome_records). */
export function buildOutcomePreview(
  audit: RecommendationAuditRecord | undefined,
): {
  status: RecommendationAuditRecord["outcomeStatus"];
  label: string;
  detail?: string;
} | null {
  if (!audit) return null;

  switch (audit.outcomeStatus) {
    case "approved":
      return {
        status: audit.outcomeStatus,
        label: "Approved — measuring outcome",
        detail: audit.outcomeSummary ?? "7-day measurement scheduled",
      };
    case "rejected":
      return { status: audit.outcomeStatus, label: "Rejected", detail: "No outcome" };
    case "measured":
      return {
        status: audit.outcomeStatus,
        label: audit.outcomeSummary ?? "Recommendation Successful",
        detail: audit.outcomeSummary,
      };
    case "no_outcome":
      return { status: audit.outcomeStatus, label: "No Outcome", detail: audit.outcomeSummary };
    default:
      return { status: "pending", label: "Pending decision" };
  }
}
