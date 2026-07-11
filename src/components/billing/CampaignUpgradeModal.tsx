"use client";

import Link from "next/link";
import type { CampaignEntitlements } from "@/lib/billing/types";
import { STARTER_DEEP_FEATURES } from "@/lib/billing/types";

type Props = {
  entitlements: CampaignEntitlements;
  campaignName: string;
  onClose: () => void;
};

export function CampaignUpgradeModal({ entitlements, campaignName, onClose }: Props) {
  return (
    <div className="adv-drawer-backdrop" onClick={onClose} role="presentation">
      <aside
        className="adv-upgrade-modal card"
        onClick={(e) => e.stopPropagation()}
        aria-label="Upgrade for deep campaign analysis"
      >
        <div className="adv-upgrade-header">
          <h3 style={{ margin: 0 }}>{campaignName}</h3>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            Close
          </button>
        </div>

        <p className="muted" style={{ margin: "12px 0 8px", fontSize: "0.9rem" }}>
          Overview metrics (health, spend, profit, ROAS, recommendation) are included for every campaign on Free.
        </p>
        <p style={{ margin: "0 0 12px" }}>
          Upgrade to {entitlements.upgradePlanLabel} for deep AI on this campaign:
        </p>

        <ul className="adv-upgrade-features">
          {STARTER_DEEP_FEATURES.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>

        <div className="adv-upgrade-actions">
          <Link href="/settings#plan" className="btn btn-primary">
            Upgrade to {entitlements.upgradePlanLabel}
          </Link>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Continue with overview
          </button>
        </div>
      </aside>
    </div>
  );
}
