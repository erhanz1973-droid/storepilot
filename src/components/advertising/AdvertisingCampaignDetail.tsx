"use client";

import { useState } from "react";
import type { AdvertisingCampaignRow, BenchmarkComparison, TimelineEntry } from "@/lib/advertising/types";
import { HEALTH_TIER_LABELS } from "@/lib/advertising/types";
import { formatRoas } from "@/lib/attribution/format-roas";

function fmt(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

const TABS = [
  "Overview",
  "Performance",
  "Benchmarks",
  "Timeline",
  "AI Recommendations",
] as const;

type Tab = (typeof TABS)[number];

type Props = {
  campaign: AdvertisingCampaignRow;
  benchmark: BenchmarkComparison;
  timeline: TimelineEntry[];
  onClose: () => void;
};

export function AdvertisingCampaignDetail({ campaign, benchmark, timeline, onClose }: Props) {
  const [tab, setTab] = useState<Tab>("Overview");

  return (
    <div className="adv-drawer-backdrop" onClick={onClose} role="presentation">
      <aside className="adv-drawer" onClick={(e) => e.stopPropagation()} aria-label="Campaign details">
        <div className="adv-drawer-header">
          <div>
            <p className="muted" style={{ margin: 0, fontSize: "0.8rem" }}>
              {campaign.platformLabel}
            </p>
            <h3 style={{ margin: "4px 0 0" }}>{campaign.campaign}</h3>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="adv-drawer-badges">
          <span className={`adv-health-pill adv-tier-${campaign.healthTier}`}>
            Health {campaign.healthScore}/100 — {HEALTH_TIER_LABELS[campaign.healthTier]}
          </span>
          <span className="adv-rec-pill">{campaign.recommendationLabel}</span>
          <span className="adv-status-pill">{campaign.status}</span>
        </div>

        <nav className="adv-drawer-tabs">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              className={tab === t ? "active" : ""}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ))}
        </nav>

        {tab === "Overview" && (
          <section className="adv-drawer-section">
            <div className="adv-drawer-metrics">
              <div><span className="muted">Spend</span><strong>{fmt(campaign.spend)}</strong></div>
              <div><span className="muted">Revenue</span><strong>{fmt(campaign.revenue)}</strong></div>
              <div>
                <span className="muted">Profit</span>
                <strong className={campaign.profit < 0 ? "negative" : "positive"}>{fmt(campaign.profit)}</strong>
              </div>
              <div><span className="muted">ROAS</span><strong>{formatRoas(campaign.roas)}</strong></div>
              <div><span className="muted">Break-even ROAS</span><strong>{campaign.breakEvenRoas != null ? formatRoas(campaign.breakEvenRoas) : "—"}</strong></div>
              <div><span className="muted">Risk</span><strong>{campaign.riskLevel}</strong></div>
            </div>
            <p className="muted" style={{ fontSize: "0.875rem" }}>
              Expected monthly opportunity if optimized:{" "}
              <strong className="positive">+{fmt(campaign.expectedOpportunityMonthly)}</strong>
            </p>
          </section>
        )}

        {tab === "Performance" && (
          <section className="adv-drawer-section">
            <p style={{ margin: 0 }}>
              Campaign is <strong>{campaign.trend === "up" ? "improving" : campaign.trend === "down" ? "declining" : "stable"}</strong> with
              ROAS {formatRoas(campaign.roas)} against break-even {campaign.breakEvenRoas != null ? formatRoas(campaign.breakEvenRoas) : "—"}.
            </p>
            <p className="muted" style={{ marginTop: 12, fontSize: "0.875rem" }}>
              Profitability: {campaign.profit >= 0 ? "Positive" : "Negative"} ({fmt(campaign.profit)}).
              Health score considers ROAS, profit, CTR, conversion rate, frequency, and trend.
            </p>
          </section>
        )}

        {tab === "Benchmarks" && (
          <section className="adv-drawer-section">
            <div className="adv-benchmark-grid">
              <div className="adv-benchmark-row">
                <span className="muted">Your ROAS</span>
                <strong>{formatRoas(benchmark.yourRoas)}</strong>
                <span className="muted">Industry Average</span>
                <span>{formatRoas(benchmark.industryAvgRoas)}</span>
                <span className="muted">Top Quartile</span>
                <span className="positive">{formatRoas(benchmark.topQuartileRoas)}</span>
              </div>
              <div className="adv-benchmark-row">
                <span className="muted">Your CPA</span>
                <strong>{fmt(benchmark.yourCpa)}</strong>
                <span className="muted">Similar Stores</span>
                <span>{fmt(benchmark.similarStoresCpa)}</span>
              </div>
              <div className="adv-benchmark-row">
                <span className="muted">Your CTR</span>
                <strong>{benchmark.yourCtr}%</strong>
                <span className="muted">Industry</span>
                <span>{benchmark.industryCtr}%</span>
              </div>
            </div>
          </section>
        )}

        {tab === "Timeline" && (
          <section className="adv-drawer-section">
            {timeline.length === 0 ? (
              <p className="muted" style={{ margin: 0 }}>No timeline events yet.</p>
            ) : (
              <ol className="adv-timeline">
                {timeline.map((e) => (
                  <li key={e.id} className={`adv-timeline-entry adv-timeline-${e.type}`}>
                    <span className="adv-timeline-date">{e.date}</span>
                    <strong>{e.label}</strong>
                    {e.detail && <span className="muted">{e.detail}</span>}
                  </li>
                ))}
              </ol>
            )}
          </section>
        )}

        {tab === "AI Recommendations" && (
          <section className="adv-drawer-section">
            <p style={{ margin: "0 0 8px" }}>
              <strong>{campaign.recommendationLabel}</strong>
            </p>
            <p className="muted" style={{ margin: 0, fontSize: "0.875rem" }}>
              Risk level: {campaign.riskLevel}. Expected monthly improvement: +{fmt(campaign.expectedOpportunityMonthly)}.
              Review in Approval Center or Decisions to execute.
            </p>
          </section>
        )}
      </aside>
    </div>
  );
}
