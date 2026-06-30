/**
 * Meta Marketing API campaign effective_status values.
 * Labels match Meta Ads Manager (English).
 * @see https://developers.facebook.com/docs/marketing-api/reference/ad-campaign-group/
 */
export const META_CAMPAIGN_EFFECTIVE_STATUSES = [
  "ACTIVE",
  "PAUSED",
  "CAMPAIGN_PAUSED",
  "ADSET_PAUSED",
  "ARCHIVED",
  "DELETED",
  "IN_PROCESS",
  "WITH_ISSUES",
  "PENDING_REVIEW",
  "DISAPPROVED",
  "PREAPPROVED",
  "PENDING_BILLING_INFO",
  "INHERITED_FROM_SOURCE",
] as const;

export type MetaCampaignEffectiveStatusRaw =
  | (typeof META_CAMPAIGN_EFFECTIVE_STATUSES)[number]
  | string;

/** Ads Manager display labels for each Meta effective_status. */
export const META_EFFECTIVE_STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Active",
  PAUSED: "Paused",
  CAMPAIGN_PAUSED: "Campaign paused",
  ADSET_PAUSED: "Ad set paused",
  ARCHIVED: "Archived",
  DELETED: "Deleted",
  IN_PROCESS: "In process",
  WITH_ISSUES: "With issues",
  PENDING_REVIEW: "In review",
  DISAPPROVED: "Disapproved",
  PREAPPROVED: "Preapproved",
  PENDING_BILLING_INFO: "Pending billing info",
  INHERITED_FROM_SOURCE: "Inherited from source",
};

export function formatMetaEffectiveStatusLabel(
  raw?: MetaCampaignEffectiveStatusRaw | null,
): string {
  if (!raw) return "Unknown";
  const key = String(raw).toUpperCase();
  return META_EFFECTIVE_STATUS_LABELS[key] ?? raw;
}

/** True only when Meta reports delivery as ACTIVE. */
export function isMetaCampaignActive(raw?: MetaCampaignEffectiveStatusRaw | null): boolean {
  return String(raw ?? "").toUpperCase() === "ACTIVE";
}

export function isMetaCampaignPaused(raw?: MetaCampaignEffectiveStatusRaw | null): boolean {
  const value = String(raw ?? "").toUpperCase();
  return value === "PAUSED" || value === "CAMPAIGN_PAUSED" || value === "ADSET_PAUSED";
}

export function normalizeCampaignNameKey(name: string): string {
  return name.trim().toLocaleLowerCase("tr-TR");
}
