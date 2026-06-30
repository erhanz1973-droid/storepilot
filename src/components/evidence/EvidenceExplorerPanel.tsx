"use client";

import { MetricPills } from "@/components/MetricPills";
import type { RecommendationEvidence } from "@/lib/evidence/types";

function TrendArrow({ direction }: { direction: string }) {
  if (direction === "up") return <span className="trend-up">↑</span>;
  if (direction === "down") return <span className="trend-down">↓</span>;
  if (direction === "flat") return <span className="trend-flat">→</span>;
  return null;
}

export function EvidenceExplorerPanel({
  evidence,
  onClose,
  embedded = false,
}: {
  evidence: RecommendationEvidence;
  onClose: () => void;
  embedded?: boolean;
}) {
  return (
    <div className={`evidence-explorer-panel ${embedded ? "embedded" : ""}`}>
      <div className="evidence-explorer-header">
        <div>
          <p className="muted" style={{ margin: 0, fontSize: "0.75rem", textTransform: "uppercase" }}>
            Evidence Explorer
          </p>
          {!embedded && <h4 style={{ margin: "4px 0 0" }}>{evidence.title}</h4>}
        </div>
        {!embedded && (
          <button className="btn btn-ghost" onClick={onClose} type="button">
            Close
          </button>
        )}
      </div>

      <div className="evidence-freshness">
        <span className="muted">Data freshness</span>
        <strong>{new Date(evidence.dataFreshness.lastSyncedAt).toLocaleString()}</strong>
        <div className="evidence-sources">
          {evidence.dataFreshness.sources.map((s) => (
            <span key={s.label} className="evidence-source-pill">
              {s.label}: {s.status}
            </span>
          ))}
        </div>
      </div>

      <section className="evidence-section">
        <h5>KPIs used</h5>
        <ul className="evidence-kpi-list">
          {evidence.kpisUsed.map((kpi) => (
            <li key={kpi}>{kpi}</li>
          ))}
        </ul>
      </section>

      {evidence.historicalComparisons.length > 0 && (
        <section className="evidence-section">
          <h5>Historical comparison</h5>
          <div className="evidence-comparison-grid">
            {evidence.historicalComparisons.map((c) => (
              <div key={c.label} className="evidence-comparison-card">
                <span className="muted" style={{ fontSize: "0.8rem" }}>
                  {c.label}
                </span>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 4 }}>
                  <strong>{c.current}</strong>
                  <TrendArrow direction={c.direction} />
                </div>
                <span className="muted" style={{ fontSize: "0.8rem" }}>
                  vs {c.previous}
                  {c.changePct != null && ` (${c.changePct > 0 ? "+" : ""}${c.changePct.toFixed(1)}%)`}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="evidence-section">
        <h5>Confidence ({Math.round(evidence.confidenceScore * 100)}%)</h5>
        <p style={{ margin: 0, lineHeight: 1.5 }}>{evidence.confidenceExplanation}</p>
        {evidence.measuredHistoricalNote && (
          <p className="evidence-measured-note" style={{ marginTop: 8 }}>
            <strong>Measured historical:</strong> {evidence.measuredHistoricalNote}
          </p>
        )}
      </section>

      <section className="evidence-section">
        <h5>Supporting metrics</h5>
        <MetricPills metrics={evidence.supportingMetrics} />
      </section>

      {evidence.sections.map((section) => (
        <section key={section.id} className="evidence-section evidence-trend-section">
          <h5>{section.title}</h5>
          {section.narrative && (
            <p className="muted" style={{ margin: "0 0 10px", fontSize: "0.875rem" }}>
              {section.narrative}
            </p>
          )}
          <MetricPills metrics={section.metrics} />
        </section>
      ))}
    </div>
  );
}
