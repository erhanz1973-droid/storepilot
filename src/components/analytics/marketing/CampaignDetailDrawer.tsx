"use client";

import { useState } from "react";
import type { EnrichedMarketingCampaign } from "@/lib/analytics/marketing-manager";
import {
  CAMPAIGN_HEALTH_EMOJI,
  CAMPAIGN_HEALTH_LABELS,
  RECOMMENDATION_LABELS,
} from "@/lib/analytics/marketing-manager";
import { ProfitValue } from "./ProfitValue";

type Props = {
  campaign: EnrichedMarketingCampaign;
  onClose: () => void;
};

const RECOVERY_STAGE_TRACK: {
  id: string;
  label: string;
  stages: string[];
}[] = [
  { id: "optimize_campaign", label: "Budget", stages: ["optimize_campaign", "reduce_budget"] },
  { id: "creative_recovery", label: "Creative", stages: ["creative_recovery"] },
  { id: "audience_recovery", label: "Audience", stages: ["audience_recovery", "review_audience"] },
  { id: "improve_conversion", label: "Landing Page", stages: ["improve_conversion", "landing_page_issue"] },
  { id: "learning_protection", label: "Learning", stages: ["learning_protection", "continue_learning"] },
  { id: "pause_campaign", label: "Pause", stages: ["pause_campaign"] },
];

function RecoveryStageTrack({ campaign }: { campaign: EnrichedMarketingCampaign }) {
  const current = campaign.recoveryStage;

  return (
    <div className="mkt-recovery-track">
      {RECOVERY_STAGE_TRACK.map((step) => {
        const isCurrent =
          step.stages.includes(current) ||
          (step.id === "optimize_campaign" &&
            (campaign.recommendation === "optimize_campaign" ||
              campaign.recommendation === "reduce_budget")) ||
          (step.id === "improve_conversion" &&
            campaign.recommendation === "landing_page_issue") ||
          (step.id === "learning_protection" &&
            campaign.recommendation === "continue_learning") ||
          (step.id === "pause_campaign" && campaign.recommendation === "pause_campaign");
        return (
          <span
            key={step.id}
            className={`mkt-recovery-track-step ${isCurrent ? "current" : ""}`}
          >
            {step.label}
          </span>
        );
      })}
    </div>
  );
}

export function CampaignDetailDrawer({ campaign, onClose }: Props) {
  const [prepared, setPrepared] = useState<string | null>(null);

  function prepareAction(label: string) {
    setPrepared(`${label} prepared — automation coming soon. Review in Decisions to approve.`);
  }

  const recoveryLow = campaign.recoveryProbabilityPct < 20;

  return (
    <div className="mkt-drawer-backdrop" onClick={onClose} role="presentation">
      <aside
        className="mkt-drawer"
        onClick={(e) => e.stopPropagation()}
        aria-label="Campaign details"
      >
        <div className="mkt-drawer-header">
          <div>
            <p className="muted" style={{ margin: 0, fontSize: "0.8rem" }}>
              {campaign.channel.toUpperCase()} Campaign
            </p>
            <h3 style={{ margin: "4px 0 0" }}>{campaign.campaign}</h3>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="mkt-drawer-badges">
          <span>
            {CAMPAIGN_HEALTH_EMOJI[campaign.health]} {CAMPAIGN_HEALTH_LABELS[campaign.health]}
          </span>
          <span className="mkt-rec-pill">{RECOMMENDATION_LABELS[campaign.recommendation]}</span>
          {campaign.isLearningPhase && (
            <span className="mkt-rec-pill mkt-rec-learning">Learning Phase</span>
          )}
        </div>

        <section className="mkt-drawer-section mkt-recovery-probability">
          <h4>Recovery Probability</h4>
          <div className="mkt-recovery-prob-row">
            <strong className={recoveryLow ? "negative" : "positive"}>
              {campaign.recoveryProbabilityPct}%
            </strong>
            <span className="muted">
              {recoveryLow
                ? "Recovery unlikely — pause may be appropriate after exhausting optimizations."
                : "Campaign can likely be recovered with the recommended optimization."}
            </span>
          </div>
          <p className="muted mkt-recovery-conf" style={{ margin: "8px 0 0", fontSize: "0.8rem" }}>
            AI confidence in this recommendation: {campaign.recoveryConfidencePct}%
          </p>
        </section>

        <section className="mkt-drawer-section">
          <h4>Recommendation</h4>
          <p style={{ margin: "0 0 8px" }}>
            <strong>{RECOMMENDATION_LABELS[campaign.recommendation]}</strong>
          </p>
          <p className="muted" style={{ margin: 0, fontSize: "0.875rem" }}>
            {campaign.recommendationReason}
          </p>
          {campaign.reEvaluateInDays != null && (
            <p className="mkt-rec-evaluate" style={{ marginTop: 8, fontSize: "0.85rem" }}>
              Re-evaluate in {campaign.reEvaluateInDays} days
            </p>
          )}
        </section>

        <section className="mkt-drawer-section">
          <h4>Recovery Stage</h4>
          <RecoveryStageTrack campaign={campaign} />
          <p className="muted" style={{ margin: "8px 0 0", fontSize: "0.8rem" }}>
            Highlighted stage is where AI recommends focusing next.
          </p>
        </section>

        <section className="mkt-drawer-section">
          <h4>AI Recovery Ladder</h4>
          <ol className="mkt-recovery-ladder">
            {campaign.recoveryLadder.map((step) => (
              <li
                key={step.id}
                className={`mkt-recovery-step mkt-recovery-step-${step.status}`}
              >
                <span aria-hidden>{step.emoji}</span>
                <span>{step.label}</span>
                <span className="muted mkt-recovery-step-status">{step.status}</span>
              </li>
            ))}
          </ol>
        </section>

        <div className="mkt-drawer-metrics">
          <div><span className="muted">Spend (7d)</span><strong>${campaign.spend.toLocaleString()}</strong></div>
          <div><span className="muted">Revenue</span><strong>${campaign.revenue.toLocaleString()}</strong></div>
          <div><span className="muted">ROAS</span><strong>{campaign.roas.toFixed(2)}</strong></div>
          <div><span className="muted">Profit</span><ProfitValue meta={campaign.profitMeta} /></div>
        </div>

        <section className="mkt-drawer-section">
          <h4>AI explanation</h4>
          <p>{campaign.aiExplanation}</p>
        </section>

        <section className="mkt-drawer-section">
          <h4>Performance snapshot</h4>
          <ul>
            <li>CTR: {campaign.ctr.toFixed(2)}%</li>
            <li>CPA: ${campaign.cpa.toFixed(0)}</li>
            <li>Share of spend: {campaign.shareOfSpendPct}%</li>
            <li>Share of revenue: {campaign.shareOfRevenuePct}%</li>
          </ul>
        </section>

        {campaign.attributedProducts.length > 0 && (
          <section className="mkt-drawer-section">
            <h4>Attributed products</h4>
            <ul>
              {campaign.attributedProducts.map((p) => (
                <li key={p.productId}>
                  <strong>{p.title}</strong> — ${p.attributedSpend.toLocaleString()} ad spend
                  <span className="muted" style={{ display: "block", fontSize: "0.8rem" }}>
                    {p.methodLabel} · {p.confidencePct}% confidence
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mkt-drawer-section">
          <h4>Actions</h4>
          <div className="mkt-action-row">
            {campaign.recommendation !== "pause_campaign" && (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => prepareAction(RECOMMENDATION_LABELS[campaign.recommendation])}
              >
                {RECOMMENDATION_LABELS[campaign.recommendation]}
              </button>
            )}
            {campaign.recommendation === "pause_campaign" && (
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => prepareAction("Pause")}>
                Pause Campaign
              </button>
            )}
            {campaign.decisionId && (
              <a href={`/decisions#${campaign.decisionId}`} className="btn btn-primary btn-sm">
                Approve
              </a>
            )}
          </div>
          {prepared && <p className="muted" style={{ marginTop: 8, fontSize: "0.85rem" }}>{prepared}</p>}
        </section>
      </aside>
    </div>
  );
}
