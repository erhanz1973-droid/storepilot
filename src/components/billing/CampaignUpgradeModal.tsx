"use client";

import type { CampaignEntitlements } from "@/lib/billing/types";
import { STARTER_DEEP_FEATURES } from "@/lib/billing/types";

type Props = {
  entitlements: CampaignEntitlements;
  campaignName: string;
  onClose: () => void;
};

export function CampaignUpgradeModal({ entitlements: _entitlements, campaignName, onClose }: Props) {
  return (
    <div className="adv-drawer-backdrop" onClick={onClose} role="presentation">
      <aside
        className="adv-upgrade-modal card"
        onClick={(e) => e.stopPropagation()}
        aria-label="Campaign analysis access"
      >
        <div className="adv-upgrade-header">
          <h3 style={{ margin: 0 }}>{campaignName}</h3>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            Close
          </button>
        </div>

        <p className="muted" style={{ margin: "12px 0 8px", fontSize: "0.9rem" }}>
          Free Early Access includes full analysis for every campaign.
        </p>
        <p style={{ margin: "0 0 12px" }}>
          Deep AI is included for {campaignName}:
        </p>

        <ul className="adv-upgrade-features">
          {STARTER_DEEP_FEATURES.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>

        <div className="adv-upgrade-actions">
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Continue
          </button>
        </div>
      </aside>
    </div>
  );
}
