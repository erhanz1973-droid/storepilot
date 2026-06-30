import { MetricPills } from "@/components/MetricPills";
import { compareKpis } from "@/lib/learning/metrics";
import type { Recommendation } from "@/lib/types";

export function RecommendationOutcomePanel({ recommendation }: { recommendation: Recommendation }) {
  const hasOutcome =
    recommendation.status === "measured" ||
    recommendation.actualImpact ||
    recommendation.predictionAccuracy;

  const deltas =
    recommendation.baselineMetrics && recommendation.outcomeMetrics
      ? compareKpis(
          recommendation.category,
          recommendation.baselineMetrics,
          recommendation.outcomeMetrics,
        )
      : [];

  return (
    <div className="outcome-panel">
      <h3>Outcome</h3>

      <div className="outcome-grid" style={{ marginTop: 16 }}>
        <div className="outcome-stat">
          <span className="muted">Expected Impact</span>
          <strong>{recommendation.expectedImpact}</strong>
        </div>
        <div className="outcome-stat">
          <span className="muted">Actual Impact</span>
          <strong>{recommendation.actualImpact ?? "Pending measurement"}</strong>
        </div>
        <div className="outcome-stat">
          <span className="muted">Prediction Accuracy</span>
          <strong>
            {recommendation.predictionAccuracy != null
              ? `${recommendation.predictionAccuracy}%`
              : "—"}
          </strong>
        </div>
        {recommendation.measurementWindowDays && (
          <div className="outcome-stat">
            <span className="muted">Measurement Window</span>
            <strong>{recommendation.measurementWindowDays} days</strong>
          </div>
        )}
      </div>

      {recommendation.implementedAt && (
        <p className="muted" style={{ marginTop: 12, fontSize: "0.85rem" }}>
          Implemented {new Date(recommendation.implementedAt).toLocaleDateString()}
          {recommendation.measuredAt &&
            ` · Measured ${new Date(recommendation.measuredAt).toLocaleDateString()}`}
        </p>
      )}

      {recommendation.status === "implemented" && !recommendation.measuredAt && (
        <p className="muted" style={{ marginTop: 12 }}>
          Measurement in progress — comparing KPIs after the {recommendation.measurementWindowDays ?? 7}-day window.
        </p>
      )}

      <div style={{ marginTop: 16 }}>
        <p className="muted" style={{ marginBottom: 8, fontWeight: 500 }}>
          Evidence
        </p>
        <MetricPills metrics={recommendation.supportingMetrics} />
      </div>

      {hasOutcome && recommendation.outcomeSummary && (
        <div style={{ marginTop: 16 }}>
          <p className="muted" style={{ marginBottom: 8, fontWeight: 500 }}>
            Outcome Summary
          </p>
          <p style={{ margin: 0, lineHeight: 1.5 }}>{recommendation.outcomeSummary}</p>
        </div>
      )}

      {deltas.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <p className="muted" style={{ marginBottom: 8, fontWeight: 500 }}>
            Before vs After
          </p>
          <ul className="action-list">
            {deltas.map((d) => (
              <li key={d.label}>
                {d.label}: {d.before} → {d.after}
                {d.changePct !== null && (
                  <span className={d.improved ? "trend-up" : "trend-down"}>
                    {" "}
                    ({d.changePct > 0 ? "+" : ""}
                    {d.changePct.toFixed(0)}%)
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
