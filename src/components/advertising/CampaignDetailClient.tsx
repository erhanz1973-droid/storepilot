"use client";

import { useEffect } from "react";
import Link from "next/link";
import type { CampaignDetailPageData } from "@/lib/advertising/types";
import { HEALTH_TIER_LABELS } from "@/lib/advertising/types";
import { formatRoas } from "@/lib/attribution/format-roas";
import { useAdvertisingCopilotCampaign } from "./AdvertisingLayoutShell";
import { AdSetAnalysisTable } from "./AdSetAnalysisTable";
import { IndividualAdsTable } from "./IndividualAdsTable";
import { CreativeIntelligenceSection } from "./CreativeIntelligenceSection";
import { AudienceAnalysisSection } from "./AudienceAnalysisSection";

function fmt(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

const TREND_ICON = { up: "↑", down: "↓", flat: "→" } as const;

const SECTIONS = [
  { id: "summary", label: "Overview" },
  { id: "performance", label: "Performance" },
  { id: "ad-sets", label: "Ad Sets" },
  { id: "ads", label: "Ads" },
  { id: "creatives", label: "Creatives" },
  { id: "audiences", label: "Audience" },
  { id: "budget", label: "Budget History" },
  { id: "approvals", label: "Approvals" },
  { id: "timeline", label: "AI Timeline" },
  { id: "simulations", label: "Simulations" },
  { id: "outcomes", label: "Outcomes" },
  { id: "optimization", label: "Optimization" },
] as const;

type Props = CampaignDetailPageData;

export function CampaignDetailClient(data: Props) {
  const { setCampaignName } = useAdvertisingCopilotCampaign();
  const { campaign } = data;

  useEffect(() => {
    setCampaignName(campaign.campaign);
    return () => setCampaignName(undefined);
  }, [campaign.campaign, setCampaignName]);

  return (
    <div className="adv-campaign-detail">
      <header className="adv-detail-header card">
        <Link href="/advertising" className="muted adv-back-link">← Back to Campaigns</Link>
        <div className="adv-detail-title-row">
          <div>
            <p className="muted" style={{ margin: 0, fontSize: "0.8rem" }}>{campaign.platformLabel}</p>
            <h2 style={{ margin: "4px 0 0" }}>{campaign.campaign}</h2>
          </div>
          <div className="adv-detail-badges">
            <span className={`adv-health-pill adv-tier-${campaign.healthTier}`}>
              Health {campaign.healthScore}
            </span>
            <span className="adv-next-action-pill">{campaign.nextAction}</span>
          </div>
        </div>
        <p className="adv-detail-summary">{data.executiveSummary}</p>
      </header>

      <nav className="adv-detail-nav card" aria-label="Campaign sections">
        {SECTIONS.map((s) => (
          <a key={s.id} href={`#${s.id}`} className="adv-detail-nav-link">
            {s.label}
          </a>
        ))}
      </nav>

      <section id="summary" className="adv-section adv-detail-section">
        <div className="adv-detail-grid">
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Executive Summary</h3>
            <p style={{ margin: 0, lineHeight: 1.5 }}>{data.executiveSummary}</p>
          </div>
          <div className="card">
            <h3 style={{ marginTop: 0 }}>AI Health Score</h3>
            <div className="adv-health-score-row">
              <strong className="adv-health-score">{campaign.healthScore}</strong>
              <span className="muted">/ 100 — {HEALTH_TIER_LABELS[campaign.healthTier]}</span>
            </div>
            <p className="muted" style={{ margin: "8px 0 0" }}>
              AI Score: <strong>{campaign.aiScore}</strong>
            </p>
            <dl className="adv-health-factors">
              {data.healthFactors.map((f) => (
                <div key={f.id} className="adv-health-factor-row">
                  <dt>{f.label}</dt>
                  <dd><span className={`adv-health-pill adv-tier-${f.tier}`}>{f.score}</span></dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      <section id="performance" className="adv-section adv-detail-section">
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Performance Overview</h3>
          <dl className="adv-detail-metrics">
            <div><dt>Spend</dt><dd>{fmt(data.performanceOverview.spend)}</dd></div>
            <div><dt>Revenue</dt><dd>{fmt(data.performanceOverview.revenue)}</dd></div>
            <div><dt>Profit</dt><dd className={data.performanceOverview.profit < 0 ? "negative" : "positive"}>{fmt(data.performanceOverview.profit)}</dd></div>
            <div><dt>ROAS</dt><dd>{formatRoas(data.performanceOverview.roas)}</dd></div>
            <div><dt>Break-even ROAS</dt><dd>{data.performanceOverview.breakEvenRoas != null ? formatRoas(data.performanceOverview.breakEvenRoas) : "—"}</dd></div>
            <div><dt>CTR</dt><dd>{data.performanceOverview.ctr}%</dd></div>
            <div><dt>Trend</dt><dd className={`adv-trend adv-trend-${data.performanceOverview.trend}`}>{TREND_ICON[data.performanceOverview.trend]}</dd></div>
          </dl>
        </div>
        <div className="card" style={{ marginTop: 12 }}>
          <h3 style={{ marginTop: 0 }}>Profitability</h3>
          <p style={{ margin: "0 0 8px" }}>{data.profitability.explanation}</p>
          <p className="muted" style={{ margin: "0 0 8px", fontSize: "0.85rem" }}>
            Gross margin: {data.profitability.grossMarginPct}% · Net profit: {fmt(data.profitability.netProfit)}
          </p>
          <ul className="adv-profit-why-chain">
            {data.profitability.chain.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ul>
        </div>
      </section>

      <section id="ad-sets" className="adv-section adv-detail-section">
        <AdSetAnalysisTable adSets={data.adSets} />
      </section>

      <section id="ads" className="adv-section adv-detail-section">
        <IndividualAdsTable ads={data.ads} />
      </section>

      <section id="creatives" className="adv-section adv-detail-section">
        <CreativeIntelligenceSection creatives={data.creatives} />
      </section>

      <section id="audiences" className="adv-section adv-detail-section">
        <AudienceAnalysisSection audiences={data.audiences} />
      </section>

      <section id="budget" className="adv-section adv-detail-section">
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Budget History</h3>
          {data.budgetHistory.length === 0 ? (
            <p className="muted" style={{ margin: 0 }}>No budget changes recorded yet.</p>
          ) : (
            <ul className="adv-timeline">
              {data.budgetHistory.map((b, i) => (
                <li key={`${b.date}-${i}`} className="adv-timeline-entry">
                  <span className="adv-timeline-date">{b.date}</span>
                  <strong>{b.label}</strong>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section id="approvals" className="adv-section adv-detail-section">
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Approval History</h3>
          {data.approvalHistory.length === 0 ? (
            <p className="muted" style={{ margin: 0 }}>No approvals submitted for this campaign yet.</p>
          ) : (
            <ul className="adv-approval-history">
              {data.approvalHistory.map((a, i) => (
                <li key={i}>
                  <strong>{a.title}</strong>
                  <span className={`adv-approval-badge adv-approval-${a.status === "approved" ? "approved" : a.status === "rejected" ? "rejected" : "pending"}`}>
                    {a.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Link href="/approvals" className="btn btn-primary btn-sm" style={{ marginTop: 12 }}>
            Submit to Approval Center
          </Link>
        </div>
      </section>

      <section id="timeline" className="adv-section adv-detail-section">
        <div className="card">
          <h3 style={{ marginTop: 0 }}>AI Timeline</h3>
          {data.aiTimeline.length === 0 ? (
            <p className="muted" style={{ margin: 0 }}>No AI events yet.</p>
          ) : (
            <ul className="adv-timeline">
              {data.aiTimeline.map((t) => (
                <li key={t.id} className="adv-timeline-entry">
                  <span className="adv-timeline-date">{t.date}</span>
                  <strong>{t.label}</strong>
                  {t.detail && <span className="muted" style={{ fontSize: "0.85rem" }}>{t.detail}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section id="simulations" className="adv-section adv-detail-section">
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Simulations</h3>
          <div className="adv-simulation-grid">
            {data.simulations.map((s) => (
              <article key={s.id} className="adv-simulation-card">
                <strong>{s.label}</strong>
                <p className="positive" style={{ margin: "8px 0 4px" }}>+{fmt(s.profitDeltaMonthly)}/mo</p>
                <span className="muted" style={{ fontSize: "0.8rem" }}>Probability: {s.probability}</span>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="outcomes" className="adv-section adv-detail-section">
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Outcome History</h3>
          {data.outcomeHistory.length === 0 ? (
            <p className="muted" style={{ margin: 0 }}>Outcomes will appear after approved actions are measured.</p>
          ) : (
            <ul className="adv-outcome-list">
              {data.outcomeHistory.map((o, i) => (
                <li key={i} className="adv-outcome-item">
                  <span className="muted" style={{ fontSize: "0.75rem" }}>{o.date}</span>
                  <strong>{o.action}</strong>
                  <span>{o.result}</span>
                  {o.profitImpact != null && (
                    <span className="muted">Accuracy: {o.profitImpact}%</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section id="optimization" className="adv-section adv-detail-section">
        {data.optimizationPackage ? (
          <div className="card adv-package-card">
            <h3 style={{ marginTop: 0 }}>Optimization Package</h3>
            <strong>{data.optimizationPackage.title}</strong>
            <div className="adv-package-steps">
              <span className="muted adv-package-steps-label">Contains</span>
              <ul className="adv-package-step-list">
                {data.optimizationPackage.steps.map((step) => (
                  <li key={step}>✓ {step}</li>
                ))}
              </ul>
            </div>
            <div className="adv-opt-grid">
              <div>
                <span className="muted">Expected Profit</span>
                <strong className="positive">+{fmt(data.optimizationPackage.expectedProfitMonthly)}</strong>
              </div>
              <div>
                <span className="muted">Time</span>
                <strong>{data.optimizationPackage.estimatedTime}</strong>
              </div>
              <div>
                <span className="muted">Risk</span>
                <strong className={`adv-risk adv-risk-${data.optimizationPackage.risk.toLowerCase()}`}>
                  {data.optimizationPackage.risk}
                </strong>
              </div>
            </div>
            <div className="adv-opt-footer">
              <Link href="/approvals" className="btn btn-primary">
                Approve Package
              </Link>
              <Link href="/approvals" className="btn btn-ghost">
                Submit to Approval Center
              </Link>
            </div>
          </div>
        ) : (
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Optimization</h3>
            <p className="muted" style={{ margin: 0 }}>No optimization package for this campaign right now.</p>
          </div>
        )}
      </section>
    </div>
  );
}
