import type { CampaignEntitlements } from "@/lib/billing/types";
import type { DeepAiExecutiveBrief } from "@/lib/analytics/deep-ai-brief";
import type { DeepAiAlignedMode } from "@/lib/analytics/deep-ai-brief";

type Props = {
  entitlements: CampaignEntitlements;
  unlockedCampaignName?: string;
  /** Wider executive dashboard presentation — same data, denser layout */
  variant?: "default" | "executive";
  /** When set (executive), lead with Analysis vs Action — not the paywall */
  deepAiBrief?: DeepAiExecutiveBrief | null;
};

export function PlanScaleBanner({
  entitlements,
  unlockedCampaignName,
  variant = "default",
  deepAiBrief = null,
}: Props) {
  if (entitlements.isUnlimited && !deepAiBrief) {
    return null;
  }

  const deepName = unlockedCampaignName ?? entitlements.unlockedCampaignName;
  const isExecutive = variant === "executive";

  if (!isExecutive) {
    return null;
  }

  const brief = mergeBrief(deepAiBrief, entitlements, deepName);

  return (
    <section
      className={`card plan-scale-banner plan-scale-banner-executive plan-scale-mode-${brief.mode.toLowerCase()}`}
      role="status"
      aria-label="Deep AI analysis"
    >
      <header className="plan-scale-exec-header">
        <div>
          <p className="exec-ceo-eyebrow">Deep AI · Analysis</p>
          <h3 className="plan-scale-exec-title">{brief.headline}</h3>
          <p className="muted plan-scale-exec-summary">{brief.summary}</p>
        </div>
      </header>

      <dl className="plan-scale-exec-stats">
        <div>
          <dt>Campaigns scanned</dt>
          <dd>{brief.campaignsScanned}</dd>
        </div>
        <div>
          <dt>Potential opportunities</dt>
          <dd>{brief.potentialOpportunities}</dd>
        </div>
        <div>
          <dt>Executive candidates</dt>
          <dd>{brief.executiveCandidates}</dd>
        </div>
        <div>
          <dt>Building evidence for</dt>
          <dd className={brief.observingCampaignName ? "positive" : undefined}>
            {brief.observingCampaignName ?? "—"}
          </dd>
        </div>
      </dl>

      {brief.whyNoAction ? (
        <p className="plan-scale-exec-why muted">{brief.whyNoAction}</p>
      ) : null}

      {brief.threshold && (brief.mode === "OBSERVE" || brief.mode === "NO_ACTION") ? (
        <div className="plan-scale-threshold" aria-label="Executive action threshold">
          <div className="plan-scale-threshold-head">
            <span>Executive Action Threshold</span>
            <strong>
              {brief.threshold.currentScore} / {brief.threshold.requiredScore}
            </strong>
          </div>
          <div
            className="plan-scale-threshold-bar"
            role="progressbar"
            aria-valuenow={brief.threshold.currentScore}
            aria-valuemin={0}
            aria-valuemax={brief.threshold.requiredScore}
          >
            <span
              style={{
                width: `${Math.min(
                  100,
                  (brief.threshold.currentScore / Math.max(brief.threshold.requiredScore, 1)) * 100,
                )}%`,
              }}
            />
          </div>
          <p className="muted plan-scale-threshold-msg">{brief.threshold.message}</p>
        </div>
      ) : null}

    </section>
  );
}

function mergeBrief(
  brief: DeepAiExecutiveBrief | null | undefined,
  entitlements: CampaignEntitlements,
  deepName: string,
): DeepAiExecutiveBrief {
  if (brief) {
    return {
      ...brief,
      campaignsScanned: Math.max(brief.campaignsScanned, entitlements.scannedCampaignCount),
      observingCampaignName: (brief.observingCampaignName ?? deepName) || null,
      upgrade: null,
    };
  }

  // Fallback when ceoOs brief missing
  return {
    mode: "OBSERVE" as DeepAiAlignedMode,
    campaignsScanned: entitlements.scannedCampaignCount,
    potentialOpportunities: 0,
    executiveCandidates: 0,
    observingCampaignName: deepName || null,
    headline: "Campaign scan complete",
    summary: `Scanned all ${entitlements.scannedCampaignCount} campaigns.`,
    whyNoAction: null,
    threshold: null,
    upgrade: null,
  };
}
