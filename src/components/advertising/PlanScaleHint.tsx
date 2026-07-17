import type { CampaignEntitlements } from "@/lib/billing/types";

/** Retained as a compatibility boundary; Version 1 has no paid plan hint. */
export function PlanScaleHint({
  entitlements: _entitlements,
}: {
  entitlements: CampaignEntitlements;
}) {
  return null;
}
