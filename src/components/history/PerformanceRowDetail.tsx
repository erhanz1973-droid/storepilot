import type { PerformanceHistoryRow } from "@/lib/history/performance-dashboard";

function fmtMoney(n: number | null): string {
  if (n == null || n === 0) return "—";
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 })}`;
}

const GRADE_CLASS = {
  excellent: "quality-excellent",
  good: "quality-good",
  needs_improvement: "quality-needs-improvement",
  pending: "quality-pending",
} as const;

export function PerformanceRowDetail({ row }: { row: PerformanceHistoryRow }) {
  const { entry, outcome } = row;
  const rec = entry.recommendation;

  return (
    <div className="performance-row-detail">
      {(row.actualMonthlyProfit != null || row.forecastAccuracyPct != null) && (
        <div className="performance-expected-actual">
          <h5>Expected vs Actual Results</h5>
          <dl className="performance-ea-grid">
            <div>
              <dt>Expected Monthly Profit</dt>
              <dd className="ai-perf-positive">{fmtMoney(row.expectedMonthlyProfit)}</dd>
            </div>
            <div>
              <dt>Actual Measured Profit</dt>
              <dd className="ai-perf-positive">{fmtMoney(row.actualMonthlyProfit)}</dd>
            </div>
            <div>
              <dt>Forecast Accuracy</dt>
              <dd>{row.forecastAccuracyPct != null ? `${row.forecastAccuracyPct}%` : "—"}</dd>
            </div>
          </dl>

          {row.metricDeltas.length > 0 && (
            <ul className="performance-metric-deltas">
              {row.metricDeltas.map((m) => (
                <li key={m.label}>
                  <strong>{m.label}</strong>: {m.before} → {m.after}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className={`performance-quality ${GRADE_CLASS[row.qualityGrade]}`}>
        <div className="performance-quality-header">
          <strong>{row.qualityLabel}</strong>
          {row.forecastAccuracyPct != null && (
            <span className="muted">Forecast Accuracy {row.forecastAccuracyPct}%</span>
          )}
        </div>
        {row.qualityGrade === "excellent" && (
          <p className="muted" style={{ margin: "6px 0 0", fontSize: "0.85rem" }}>
            Business Impact: High · Confidence Correct: Yes
          </p>
        )}
        {row.qualityGrade === "needs_improvement" && outcome?.outcomeSummary && (
          <p className="muted" style={{ margin: "6px 0 0", fontSize: "0.85rem" }}>
            Reason: {outcome.outcomeSummary}
          </p>
        )}
      </div>

      {row.learningFeedback && (
        <div className="performance-learning">
          <h5>Learning Result</h5>
          <p>{row.learningFeedback}</p>
        </div>
      )}

      {rec.reason && (
        <div className="performance-why">
          <h5>Why it was recommended</h5>
          <p className="muted">{rec.reason}</p>
        </div>
      )}
    </div>
  );
}
