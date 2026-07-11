import type { CampaignEntitlements } from "@/lib/billing/types";
import Link from "next/link";
import { buildScaleUpgradeMessage } from "@/lib/billing/entitlements";

type Props = {
  entitlements: CampaignEntitlements;
  unlockedCampaignName?: string;
};

export function PlanScaleBanner({ entitlements, unlockedCampaignName }: Props) {
  if (entitlements.isUnlimited) {
    return null;
  }

  const message = buildScaleUpgradeMessage(entitlements);
  const deepName = unlockedCampaignName ?? entitlements.unlockedCampaignName;

  return (
    <div className="card plan-scale-banner" role="status">
      <div className="plan-scale-banner-body">
        <p style={{ margin: 0, fontWeight: 600 }}>
          Scanned all {entitlements.scannedCampaignCount} campaigns
          {deepName ? (
            <>
              {" "}
              — deep AI active for <span className="positive">{deepName}</span>
            </>
          ) : null}
        </p>
        <p className="muted" style={{ margin: "8px 0 0", fontSize: "0.9rem" }}>
          {message}
        </p>
      </div>
      <Link href="/settings#plan" className="btn btn-primary btn-sm plan-scale-cta">
        Upgrade to {entitlements.upgradePlanLabel}
      </Link>
    </div>
  );
}
