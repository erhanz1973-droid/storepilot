export {
  getAllApprovals,
  getRecommendationById,
  listRecommendationHistory,
  listStoredRecommendations,
  syncRecommendations,
  updateRecommendationStatus,
} from "@/lib/db/recommendations";

// Backward-compatible alias
export { updateRecommendationStatus as setApproval } from "@/lib/db/recommendations";

export function isActiveApproval(
  approval: { status: string; snoozedUntil?: string } | null,
): boolean {
  if (!approval) return true;
  if (["ignored", "approved", "completed", "implemented", "measured"].includes(approval.status)) return false;
  if (approval.status === "snoozed" && approval.snoozedUntil) {
    return new Date(approval.snoozedUntil) <= new Date();
  }
  return approval.status === "pending" || approval.status === "snoozed";
}
