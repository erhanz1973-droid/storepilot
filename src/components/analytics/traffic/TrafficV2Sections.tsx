"use client";

import Link from "next/link";
import { TrafficRevenueProfitSection } from "@/components/analytics/traffic/TrafficRevenueProfitCard";
import type {
  DeviceIntelligence,
  LandingPageIntelligence,
  TrafficBrief,
  TrafficBusinessKpi,
  TrafficHealthScore,
  TrafficOpportunity,
  TrafficSourceQuality,
} from "@/lib/analytics/traffic-manager-v2";

function fmt(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function toneClass(tone?: TrafficBusinessKpi["tone"]) {
  if (tone === "positive") return "trf-v2-kpi-positive";
  if (tone === "negative") return "trf-v2-kpi-negative";
  if (tone === "warning") return "trf-v2-kpi-warning";
  return "";
}

function scoreTone(score: number) {
  if (score >= 90) return "positive";
  if (score >= 75) return "positive";
  if (score >= 60) return "warning";
  return "negative";
}

export function TrafficBriefCard({ brief }: { brief: TrafficBrief }) {
  return (
    <section className="card trf-v2-brief">
      <div className="trf-v2-brief-header">
        <span className="trf-v2-brief-icon" aria-hidden>
          ✦
        </span>
        <div>
          <p className="trf-v2-brief-greeting">{brief.greeting}.</p>
          <p className="muted trf-v2-brief-sub">Your AI Traffic Analyst has reviewed your latest traffic.</p>
        </div>
      </div>
      <div className="trf-v2-brief-body">
        {brief.lines.map((line) => (
          <p key={line} className="trf-v2-brief-line">
            {line}
          </p>
        ))}
      </div>
      {brief.todayPriority && (
        <div className="trf-v2-brief-priority">
          <span className="trf-v2-priority-label">Today&apos;s highest priority</span>
          <strong>{brief.todayPriority}</strong>
          {brief.todayPriorityAction && (
            <span className="trf-v2-priority-action">{brief.todayPriorityAction}</span>
          )}
        </div>
      )}
    </section>
  );
}

export function TrafficBusinessKpiRow({ kpis }: { kpis: TrafficBusinessKpi[] }) {
  return (
    <div className="analytics-metric-grid trf-v2-kpi-grid">
      {kpis.map((kpi) => (
        <div key={kpi.id} className={`analytics-metric-card trf-v2-kpi ${toneClass(kpi.tone)}`}>
          <p className="analytics-metric-label">{kpi.label}</p>
          <p className="analytics-metric-value">{kpi.value}</p>
          {kpi.sublabel && <p className="analytics-metric-sublabel">{kpi.sublabel}</p>}
        </div>
      ))}
    </div>
  );
}

export function TrafficHealthCard({ health }: { health: TrafficHealthScore }) {
  if (health.overall <= 0) return null;

  return (
    <section className="card trf-v2-health">
      <div className="trf-v2-health-header">
        <div>
          <h3 style={{ marginTop: 0 }}>Traffic Health</h3>
          <p className="muted" style={{ margin: 0 }}>
            One score for traffic quality, conversion, and growth potential
          </p>
        </div>
        <div className={`trf-v2-health-overall trf-v2-score-${scoreTone(health.overall)}`}>
          <span className="trf-v2-health-value">{health.overall}</span>
          <span className="muted">/ 100</span>
        </div>
      </div>
      <div className="trf-v2-health-factors">
        {health.factors.map((f) => (
          <div key={f.id} className="trf-v2-health-factor">
            <div className="trf-v2-health-factor-top">
              <span>{f.label}</span>
              <strong className={`trf-v2-score-${scoreTone(f.score)}`}>{f.score}</strong>
            </div>
            <div className="trf-v2-health-bar">
              <div
                className={`trf-v2-health-fill trf-v2-score-${scoreTone(f.score)}`}
                style={{ width: `${f.score}%` }}
              />
            </div>
            <p className="muted trf-v2-health-explanation">{f.explanation}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function TrafficSourceQualitySection({ sources }: { sources: TrafficSourceQuality[] }) {
  if (!sources.length) return null;

  return (
    <section className="card trf-v2-sources">
      <h3 style={{ marginTop: 0 }}>Traffic Quality by Source</h3>
      <p className="muted trf-v2-section-desc">
        Quality score weighs conversion, revenue per session, and engagement — not just volume.
      </p>
      <div className="trf-v2-source-list">
        {sources.map((s) => (
          <article key={s.id} className="trf-v2-source-card">
            <div className="trf-v2-source-header">
              <div>
                <h4>{s.label}</h4>
                <span className="muted">{s.sessions.toLocaleString()} sessions</span>
              </div>
              <div className={`trf-v2-quality-badge trf-v2-score-${scoreTone(s.qualityScore)}`}>
                {s.qualityScore} / 100
              </div>
            </div>
            <div className="trf-v2-source-metrics">
              <div><span className="muted">Revenue</span><strong>{fmt(s.revenue)}</strong></div>
              <div><span className="muted">Conversion</span><strong>{s.conversionRatePct.toFixed(1)}%</strong></div>
              <div><span className="muted">AOV</span><strong>{fmt(s.aov)}</strong></div>
              <div><span className="muted">Status</span><strong>{s.statusLabel}</strong></div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export function TrafficChannelProfitabilitySection({
  sources,
}: {
  sources: TrafficSourceQuality[];
}) {
  const cards = sources
    .map((s) => s.trafficFlowCard)
    .filter((c): c is NonNullable<typeof c> => c != null);

  return <TrafficRevenueProfitSection cards={cards} />;
}

/** @deprecated Use TrafficChannelProfitabilitySection */
export function TrafficRevenueFlowSection({
  sources,
}: {
  sources: TrafficSourceQuality[];
}) {
  return <TrafficChannelProfitabilitySection sources={sources} />;
}

export function TrafficDeviceSection({ devices }: { devices: DeviceIntelligence[] }) {
  if (!devices.length) return null;

  return (
    <section className="card trf-v2-devices">
      <h3 style={{ marginTop: 0 }}>Device Intelligence</h3>
      <div className="trf-v2-device-grid">
        {devices.map((d) => (
          <article key={d.device} className="trf-v2-device-card">
            <h4>{d.device}</h4>
            <p className="trf-v2-device-share">{d.trafficSharePct.toFixed(0)}% of traffic</p>
            <div className="trf-v2-device-metrics">
              <div>
                <span className="muted">Conversion</span>
                <strong>{d.conversionRatePct.toFixed(1)}%</strong>
              </div>
              <div>
                <span className="muted">Revenue</span>
                <strong>{fmt(d.revenue)}</strong>
              </div>
              <div>
                <span className="muted">Status</span>
                <strong>{d.statusLabel}</strong>
              </div>
            </div>
            <div className="trf-v2-rec-block">
              <span className="trf-v2-rec-label">AI Recommendation</span>
              <strong>{d.aiRecommendation}</strong>
              <ul className="trf-v2-reason-list">
                {d.recommendationReasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

const REC_KIND_CLASS: Record<LandingPageIntelligence["recommendationKind"], string> = {
  excellent: "trf-v2-lp-excellent",
  improve_headline: "trf-v2-lp-warning",
  slow_mobile: "trf-v2-lp-warning",
  checkout_dropoff: "trf-v2-lp-danger",
  optimize: "trf-v2-lp-warning",
  unknown: "",
};

export function TrafficLandingPagesSection({ pages }: { pages: LandingPageIntelligence[] }) {
  if (!pages.length) return null;

  return (
    <section className="card trf-v2-landing">
      <h3 style={{ marginTop: 0 }}>Landing Page Intelligence</h3>
      <div className="trf-v2-landing-table-wrap">
        <table className="trf-v2-landing-table">
          <thead>
            <tr>
              <th>Landing Page</th>
              <th>Sessions</th>
              <th>Conversion</th>
              <th>Revenue</th>
              <th>Bounce</th>
              <th>Engagement</th>
              <th>AI Recommendation</th>
            </tr>
          </thead>
          <tbody>
            {pages.map((p) => (
              <tr key={p.id}>
                <td className="trf-v2-lp-path">{p.path}</td>
                <td>{p.sessions.toLocaleString()}</td>
                <td>{p.conversionRatePct.toFixed(1)}%</td>
                <td>{fmt(p.revenue)}</td>
                <td>{p.bounceRatePct != null ? `${p.bounceRatePct.toFixed(0)}%` : "—"}</td>
                <td>
                  {p.avgEngagementSec != null
                    ? `${Math.floor(p.avgEngagementSec / 60)}m ${Math.round(p.avgEngagementSec % 60)}s`
                    : "—"}
                </td>
                <td>
                  <span className={`trf-v2-lp-rec ${REC_KIND_CLASS[p.recommendationKind]}`}>
                    {p.recommendation}
                  </span>
                  {p.estimatedRecoveryMonthly > 0 && (
                    <span className="trf-v2-lp-recovery muted">
                      +{fmt(p.estimatedRecoveryMonthly)}/mo
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function TrafficOpportunitySection({ opportunities }: { opportunities: TrafficOpportunity[] }) {
  if (!opportunities.length) return null;

  return (
    <section className="card trf-v2-opportunities">
      <h3 style={{ marginTop: 0 }}>Biggest Opportunities</h3>
      <p className="muted trf-v2-section-desc">Sorted by expected business impact.</p>
      <ol className="trf-v2-opp-list">
        {opportunities.map((o, i) => (
          <li key={o.id} className="trf-v2-opp-item">
            <div className="trf-v2-opp-rank">{i + 1}</div>
            <div className="trf-v2-opp-body">
              <div className="trf-v2-opp-header">
                <strong>{o.title}</strong>
                <span className="trf-v2-opp-impact positive">+{fmt(o.estimatedProfitMonthly)}/month</span>
              </div>
              <p className="muted trf-v2-recovery-prob">Recovery probability: {o.recoveryProbabilityPct}%</p>
              <ul className="trf-v2-reason-list">
                {o.reasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function TrafficGa4EmptyState() {
  return (
    <div className="card trf-v2-empty">
      <p className="muted" style={{ margin: 0 }}>
        Traffic intelligence requires GA4.{" "}
        <Link href="/connections?tab=analytics">Connect GA4</Link> to unlock channel quality, landing
        page recommendations, and profit attribution by source.
      </p>
    </div>
  );
}
