"use client";

import type { AdvertisingExecutiveOverview as OverviewType } from "@/lib/advertising/types";
import type { CampaignEntitlements } from "@/lib/billing/types";
import { HEALTH_TIER_LABELS } from "@/lib/advertising/types";

function fmt(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export function AdvertisingExecutiveOverview({
  overview,
  planUsage,
}: {
  overview: OverviewType;
  planUsage?: CampaignEntitlements;
}) {
  return (
    <div className="adv-executive-grid">
      {overview.analysisScopeNotice && (
        <div className="card adv-scope-notice">
          <span className="muted adv-hero-label">Analysis Scope</span>
          <strong>{overview.analysisScopeNotice}</strong>
          {planUsage && !planUsage.isUnlimited && (
            <p className="muted" style={{ margin: "6px 0 0", fontSize: "0.85rem" }}>
              Upgrade to {planUsage.upgradePlanLabel} for complete advertising intelligence.
            </p>
          )}
        </div>
      )}
      <div className="card adv-health-hero">
        <span className="muted adv-hero-label">Advertising Health</span>
        <div className="adv-health-score-row">
          <strong className="adv-health-score">{overview.healthScore}</strong>
          <span className="muted">/ 100</span>
        </div>
        <span className={`adv-health-tier adv-tier-${overview.healthTier}`}>
          {HEALTH_TIER_LABELS[overview.healthTier]}
        </span>
        {overview.healthFactors && overview.healthFactors.length > 0 && (
          <dl className="adv-health-factors">
            {overview.healthFactors.map((f) => (
              <div key={f.id} className="adv-health-factor-row">
                <dt>{f.label}</dt>
                <dd>
                  <span className={`adv-health-pill adv-tier-${f.tier}`}>{f.score}</span>
                </dd>
              </div>
            ))}
          </dl>
        )}
      </div>

      <div className="card adv-status-card">
        <span className="muted adv-hero-label">Business Status</span>
        <strong className="adv-status-value">
          {overview.businessStatusEmoji} {overview.businessStatus}
        </strong>
      </div>

      <div className="card adv-opportunity-card">
        <span className="muted adv-hero-label">Today&apos;s Top Opportunity</span>
        <strong className="adv-opportunity-title">{overview.topOpportunity}</strong>
        <div className="adv-opportunity-impact">
          <span className="muted">Expected Monthly Profit Improvement</span>
          <strong className="positive">+{fmt(overview.expectedMonthlyProfitImprovement)}</strong>
        </div>
      </div>

      <div className="card adv-kpi-card">
        <span className="muted adv-hero-label">Advertising Spend (30 Days)</span>
        <strong>{fmt(overview.spend30d)}</strong>
      </div>

      <div className="card adv-kpi-card">
        <span className="muted adv-hero-label">Revenue Generated</span>
        <strong>{fmt(overview.revenue30d)}</strong>
      </div>

      <div className="card adv-kpi-card">
        <span className="muted adv-hero-label">Blended ROAS</span>
        <strong>{overview.blendedRoas.toFixed(2)}</strong>
      </div>

      <div className="card adv-kpi-card">
        <span className="muted adv-hero-label">AI Confidence</span>
        <strong>{overview.aiConfidencePct}%</strong>
      </div>
    </div>
  );
}
