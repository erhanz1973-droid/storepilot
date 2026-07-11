"use client";

import Link from "next/link";
import type { CampaignEntitlements } from "@/lib/billing/types";

/** Soft upgrade hint — shown after value, not before. */
export function PlanScaleHint({
  entitlements,
}: {
  entitlements: CampaignEntitlements;
}) {
  if (entitlements.isUnlimited) {
    return null;
  }

  return (
    <div className="adv-plan-hint card" role="status">
      <p style={{ margin: 0, fontSize: "0.9rem" }}>
        All {entitlements.scannedCampaignCount} campaigns are scanned on {entitlements.planLabel}.
        Deep AI (root cause, creatives, simulations, packages) is active for{" "}
        <strong>{entitlements.unlockedCampaignName}</strong>.
        {" "}
        <Link href="/settings#plan" className="adv-plan-hint-link">
          Upgrade to {entitlements.upgradePlanLabel}
        </Link>
        {" "}
        for deep analysis on every campaign.
      </p>
    </div>
  );
}
