import type { AiPerformanceSummary } from "@/lib/types";

export function AiPerformanceCard({ performance }: { performance: AiPerformanceSummary }) {
  const hasData = performance.measuredCount > 0;

  return (
    <div className="card ai-performance-card">
      <h3>AI Performance</h3>

      {!hasData ? (
        <p className="muted" style={{ marginTop: 12 }}>
          No measured recommendations yet. Mark recommendations as implemented to start the
          learning loop.
        </p>
      ) : (
        <div className="ai-performance-grid" style={{ marginTop: 16 }}>
          <div className="ai-performance-stat">
            <span className="muted">Prediction Accuracy</span>
            <strong className="ai-performance-value">{performance.predictionAccuracy}%</strong>
          </div>
          <div className="ai-performance-stat">
            <span className="muted">Measured Recommendations</span>
            <strong className="ai-performance-value">{performance.measuredCount}</strong>
          </div>
          <div className="ai-performance-stat">
            <span className="muted">Estimated Revenue Influenced</span>
            <strong className="ai-performance-value">
              ${performance.revenueInfluenced.toLocaleString()}
            </strong>
          </div>
          <div className="ai-performance-stat">
            <span className="muted">Best Category</span>
            <strong className="ai-performance-value">{performance.bestCategoryLabel}</strong>
          </div>
        </div>
      )}
    </div>
  );
}
