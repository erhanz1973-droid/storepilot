"use client";

import { useState } from "react";
import type { BusinessHealthDashboard, BusinessHealthStatus } from "@/lib/business-health/types";
import { FINANCIAL_IMPACT_LABELS, normalizeBusinessHealthDashboard } from "@/lib/business-health/normalize";
import { healthDomainHref } from "@/lib/analytics/executive-modules";
import { ExecutiveStoryNav } from "@/components/executive/ExecutiveStoryNav";
import { BusinessRiskAssessmentPanel } from "@/components/ask-ai/BusinessRiskAssessmentPanel";
import Link from "next/link";

const STATUS_LABEL: Record<BusinessHealthStatus, string> = {
  healthy: "Healthy",
  warning: "Warning",
  critical: "Critical",
  limited: "Limited",
};

function statusClass(status: BusinessHealthStatus): string {
  return `bh-status bh-status-${status}`;
}

function scoreColor(score: number): string {
  if (score >= 70) return "var(--low)";
  if (score >= 45) return "var(--medium)";
  return "var(--critical)";
}

function trendArrow(direction: string): string {
  if (direction === "improving") return "▲";
  if (direction === "declining") return "▼";
  return "●";
}

function HealthSparkline({ points }: { points: { score: number }[] }) {
  if (points.length < 2) {
    return (
      <div className="bh-sparkline bh-sparkline-empty muted">
        History builds as daily snapshots are recorded
      </div>
    );
  }
  const scores = points.map((p) => p.score);
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const range = Math.max(max - min, 1);

  return (
    <div className="bh-sparkline">
      <svg viewBox={`0 0 ${scores.length * 12} 40`} preserveAspectRatio="none" className="bh-sparkline-svg">
        <polyline
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2"
          points={scores
            .map((s, i) => `${i * 12 + 6},${36 - ((s - min) / range) * 32}`)
            .join(" ")}
        />
      </svg>
      <div className="bh-sparkline-labels">
        {scores.length <= 6
          ? scores.map((s, i) => (
              <span key={i} className={i === scores.length - 1 ? "bh-spark-current" : ""}>
                {s}
              </span>
            ))
          : (
            <>
              <span>{scores[0]}</span>
              <span className="muted">…</span>
              <span>{scores[scores.length - 2]}</span>
              <span className="bh-spark-current">{scores[scores.length - 1]}</span>
            </>
          )}
      </div>
    </div>
  );
}

export function BusinessHealthDashboardClient({
  dashboard: raw,
}: {
  dashboard: BusinessHealthDashboard;
}) {
  const dashboard = normalizeBusinessHealthDashboard(raw);
  const { overall } = dashboard;
  const overallColor = scoreColor(overall.score);
  const [breakdownOpen, setBreakdownOpen] = useState(false);

  const weightedScore = Math.round(
    dashboard.breakdown.reduce((sum, row) => sum + row.score * row.weightPct, 0) /
      Math.max(dashboard.breakdown.reduce((s, r) => s + r.weightPct, 0), 1),
  );

  return (
    <div className="bh-dashboard">
      <section className="bh-morning-briefing">
        <h3 className="bh-morning-briefing-title">
          What could hurt my business the most right now?
        </h3>
        <BusinessRiskAssessmentPanel assessment={dashboard.riskAssessment} />
      </section>

      <section className="card bh-hero bh-hero-rich">
        <div className="bh-hero-main">
          <p className="bh-eyebrow">Store Health</p>
          <div className="bh-hero-score-row">
            <strong style={{ color: overallColor }}>
              {overall.score}
              <span className="bh-score-max"> / {overall.maxScore}</span>
            </strong>
            <span className="bh-hero-status">
              {overall.statusEmoji} {overall.label}
            </span>
          </div>
          <dl className="bh-hero-meta">
            <div>
              <dt>Primary Issue</dt>
              <dd>{overall.primaryIssue}</dd>
            </div>
            <div>
              <dt>Biggest Opportunity</dt>
              <dd>{overall.biggestOpportunity}</dd>
            </div>
            <div>
              <dt>30-Day Trend</dt>
              <dd className={`bh-trend bh-trend-${overall.trend.direction}`}>
                {trendArrow(overall.trend.direction)} {overall.trend.label}
                {overall.trend.deltaPoints != null && ` (${overall.trend.deltaPoints >= 0 ? "+" : ""}${overall.trend.deltaPoints})`}
              </dd>
            </div>
            <div>
              <dt>Last Updated</dt>
              <dd>{new Date(overall.lastUpdated).toLocaleString()}</dd>
            </div>
          </dl>
        </div>
        <div className="bh-hero-history">
          <span className="muted">30-Day Health</span>
          <HealthSparkline points={dashboard.history} />
        </div>
      </section>

      <div className="bh-risk-strip card">
        <span className="bh-risk-pill bh-risk-critical">
          Critical <strong>{dashboard.riskDistribution.critical}</strong>
        </span>
        <span className="bh-risk-pill bh-risk-warning">
          Warning <strong>{dashboard.riskDistribution.warning}</strong>
        </span>
        <span className="bh-risk-pill bh-risk-healthy">
          Healthy <strong>{dashboard.riskDistribution.healthy}</strong>
        </span>
        {dashboard.riskDistribution.limited > 0 && (
          <span className="bh-risk-pill bh-risk-limited">
            Limited <strong>{dashboard.riskDistribution.limited}</strong>
          </span>
        )}
      </div>

      <section className="card bh-breakdown-card">
        <button
          type="button"
          className="bh-breakdown-toggle"
          onClick={() => setBreakdownOpen((open) => !open)}
          aria-expanded={breakdownOpen}
        >
          <h3>Store Health Calculation</h3>
          <span className="muted">{breakdownOpen ? "Hide" : "Show"} breakdown</span>
        </button>
        {breakdownOpen && (
          <div className="bh-breakdown-expanded">
            <ul className="bh-breakdown-list">
              {dashboard.breakdown.map((row) => (
                <li key={row.id}>
                  <div className="bh-breakdown-row-head">
                    <span>{row.label}</span>
                    <span className="muted">{row.weightPct}%</span>
                  </div>
                  <div className="bh-breakdown-bar-wrap">
                    <div
                      className="bh-breakdown-bar"
                      style={{ width: `${row.score}%`, background: scoreColor(row.score) }}
                    />
                  </div>
                  <strong style={{ color: scoreColor(row.score) }}>{row.score} / 100</strong>
                </li>
              ))}
            </ul>
            <div className="bh-breakdown-overall">
              <span>Overall Health</span>
              <strong style={{ color: overallColor }}>
                {weightedScore} / 100
              </strong>
              <p className="muted" style={{ margin: "4px 0 0", fontSize: "0.85rem" }}>
                Weighted from area scores above — explains why Store Health is {overall.score}.
              </p>
            </div>
          </div>
        )}
      </section>

      {dashboard.strengths.length > 0 && (
        <section className="card bh-strengths">
          <h3>Business Strengths</h3>
          <ul className="bh-strength-list">
            {dashboard.strengths.map((s) => (
              <li key={s.id}>
                <span className="bh-strength-check">✓</span>
                <div>
                  <strong>{s.label}</strong>
                  <p className="muted" style={{ margin: "4px 0 0" }}>{s.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card">
        <h3>Health by Area</h3>
        <div className="bh-domain-cards">
          {dashboard.domains.map((d) => (
            <article key={d.id} className="bh-domain-card">
              <header className="bh-domain-card-head">
                <h4>{d.label}</h4>
                <span className={statusClass(d.status)}>{STATUS_LABEL[d.status]}</span>
              </header>
              <Link href={healthDomainHref(d.id)} className="bh-domain-module-link">
                Open {d.label} module →
              </Link>
              <p className={`bh-domain-trend bh-trend-${d.trend.direction}`}>
                {d.trend.windowLabel}: {trendArrow(d.trend.direction)} {d.trend.label}
                {d.trend.deltaPoints != null && ` (${d.trend.deltaPoints >= 0 ? "+" : ""}${d.trend.deltaPoints})`}
              </p>

              <div className="bh-domain-section">
                <span className="bh-domain-label">Current Situation</span>
                <p>{d.currentSituation}</p>
              </div>
              <div className="bh-domain-section">
                <span className="bh-domain-label">Why It Matters</span>
                <p>{d.whyItMatters}</p>
              </div>
              <div className="bh-domain-section">
                <span className="bh-domain-label">Recommended Action</span>
                <p><strong>{d.recommendedAction}</strong></p>
              </div>
              <div className="bh-domain-section">
                <span className="bh-domain-label">Expected Outcome</span>
                <p>{d.expectedOutcome}</p>
              </div>
              {d.estimatedImpact && (
                <div className="bh-domain-section">
                  <span className="bh-domain-label">
                    {FINANCIAL_IMPACT_LABELS[d.financialImpactType]}
                  </span>
                  <p className="bh-impact-positive">{d.estimatedImpact}</p>
                </div>
              )}
              {d.inactionConsequence && (
                <div className="bh-domain-section bh-inaction">
                  <span className="bh-domain-label">If no action is taken</span>
                  <p>
                    {d.inactionConsequence.label}
                    {d.inactionConsequence.amountMonthly != null && d.inactionConsequence.amountMonthly > 0
                      ? `: $${d.inactionConsequence.amountMonthly.toLocaleString()}/month`
                      : " may continue to erode performance."}
                  </p>
                </div>
              )}
            </article>
          ))}
        </div>
      </section>

      {dashboard.benchmark && (
        <section className="card">
          <h3>Compared with {dashboard.benchmark.similarStoreCount} Similar Stores</h3>
          <p className="muted" style={{ marginTop: 0 }}>{dashboard.benchmark.cohortLabel}</p>
          <div className="bh-benchmark-grid">
            {dashboard.benchmark.rows.map((row) => (
              <article
                key={row.id}
                className={`bh-benchmark-item bh-benchmark-${row.interpretationKind}`}
              >
                <div className="bh-benchmark-head">
                  <strong>{row.label}</strong>
                  <span
                    className={
                      row.percentile >= 60
                        ? "bh-pct-good"
                        : row.percentile <= 25
                          ? "bh-pct-low"
                          : "bh-pct-mid"
                    }
                  >
                    {row.percentile}th percentile
                  </span>
                </div>
                <p className="bh-benchmark-meaning">
                  <span className="bh-benchmark-tag">
                    {row.interpretationKind === "strength" ? "Strength" : row.interpretationKind === "weakness" ? "Meaning" : "Context"}
                  </span>
                  {row.interpretation}
                </p>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="card bh-action-plan">
        <h3>Supporting Priorities</h3>
        <p className="muted" style={{ marginTop: 0, marginBottom: 12, fontSize: "0.875rem" }}>
          Additional actions across business areas — start with the biggest risk above.
        </p>
        <ol className="bh-priority-list bh-priority-rich">
          {dashboard.actionPlan.map((item) => (
            <li key={item.rank}>
              <div className="bh-priority-head">
                <span className="bh-priority-rank">{item.rank}</span>
                <strong>{item.title}</strong>
              </div>
              <dl className="bh-priority-meta">
                <div>
                  <dt>{FINANCIAL_IMPACT_LABELS[item.financialImpactType]}</dt>
                  <dd>{item.impactLabel}</dd>
                </div>
                <div>
                  <dt>Difficulty</dt>
                  <dd>{item.difficulty}</dd>
                </div>
                <div>
                  <dt>Time Required</dt>
                  <dd>{item.timeRequired}</dd>
                </div>
                <div>
                  <dt>Confidence</dt>
                  <dd>{item.confidence}</dd>
                </div>
                <div>
                  <dt>Est. Time Until Results</dt>
                  <dd>{item.timeUntilResults}</dd>
                </div>
              </dl>
            </li>
          ))}
        </ol>
      </section>

      <p className="muted bh-footer-note">
        Data sync and AI readiness live on{" "}
        <Link href="/integration-health">Integration Health</Link>.
      </p>

      <ExecutiveStoryNav current="health" />
    </div>
  );
}
