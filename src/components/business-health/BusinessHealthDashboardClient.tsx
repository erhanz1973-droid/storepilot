"use client";

import type { BusinessHealthDashboard, BusinessHealthStatus } from "@/lib/business-health/types";
import { normalizeBusinessHealthDashboard } from "@/lib/business-health/normalize";
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

  return (
    <div className="bh-dashboard">
      <section className="card bh-exec-summary">
        <p className="bh-eyebrow">{dashboard.executiveSummary.headline}</p>
        <p className="bh-exec-narrative">{dashboard.executiveSummary.narrative}</p>
        <div className="bh-exec-priority">
          <div>
            <span className="muted">Highest Priority</span>
            <strong>{dashboard.executiveSummary.highestPriority}</strong>
          </div>
          {dashboard.executiveSummary.estimatedMonthlyImprovement && (
            <div>
              <span className="muted">Estimated Monthly Improvement</span>
              <strong className="bh-impact-positive">
                {dashboard.executiveSummary.estimatedMonthlyImprovement}
              </strong>
            </div>
          )}
        </div>
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

      <section className="card">
        <h3>Score Breakdown</h3>
        <ul className="bh-breakdown-list">
          {dashboard.breakdown.map((row) => (
            <li key={row.id}>
              <span>{row.label}</span>
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
      </section>

      <section className="card">
        <h3>Health by Area</h3>
        <div className="bh-domain-cards">
          {dashboard.domains.map((d) => (
            <article key={d.id} className="bh-domain-card">
              <header className="bh-domain-card-head">
                <h4>{d.label}</h4>
                <span className={statusClass(d.status)}>{STATUS_LABEL[d.status]}</span>
              </header>
              <p className={`bh-domain-trend bh-trend-${d.trend.direction}`}>
                {d.trend.windowLabel}: {trendArrow(d.trend.direction)} {d.trend.label}
                {d.trend.deltaPoints != null && ` (${d.trend.deltaPoints >= 0 ? "+" : ""}${d.trend.deltaPoints})`}
              </p>
              <div className="bh-domain-section">
                <span className="bh-domain-label">Why?</span>
                <p>{d.why}</p>
              </div>
              <div className="bh-domain-section">
                <span className="bh-domain-label">Recommended Action</span>
                <p>{d.recommendedAction}</p>
              </div>
              {d.estimatedImpact && (
                <div className="bh-domain-section">
                  <span className="bh-domain-label">Estimated Business Impact</span>
                  <p className="bh-impact-positive">{d.estimatedImpact}</p>
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
          <table className="bh-benchmark-table">
            <thead>
              <tr>
                <th>Metric</th>
                <th>Percentile</th>
              </tr>
            </thead>
            <tbody>
              {dashboard.benchmark.rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.label}</td>
                  <td>
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
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section className="card bh-action-plan">
        <h3>Today&apos;s Priorities</h3>
        <ol className="bh-priority-list">
          {dashboard.actionPlan.map((item) => (
            <li key={item.rank}>
              <div className="bh-priority-head">
                <span className="bh-priority-rank">{item.rank}</span>
                <strong>{item.title}</strong>
              </div>
              <span className="muted">Estimated Impact: {item.impactLabel}</span>
            </li>
          ))}
        </ol>
      </section>

      <p className="muted bh-footer-note">
        Data sync and AI readiness live on{" "}
        <Link href="/integration-health">Integration Health</Link>.
      </p>
    </div>
  );
}
