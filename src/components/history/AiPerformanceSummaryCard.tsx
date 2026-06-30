import type { AiPerformanceSummaryStats } from "@/lib/history/performance-dashboard";

function fmt(n: number): string {
  if (n <= 0) return "$0";
  return `+${n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 })}`;
}

export function AiPerformanceSummaryCard({ summary }: { summary: AiPerformanceSummaryStats }) {
  return (
    <section className="card ai-performance-summary">
      <p className="ai-perf-eyebrow">AI Performance Dashboard</p>
      <h3>AI Recommendation Performance</h3>

      <dl className="ai-perf-grid">
        <div>
          <dt>Recommendations Generated</dt>
          <dd>{summary.generated}</dd>
        </div>
        <div>
          <dt>Approved</dt>
          <dd>{summary.approved}</dd>
        </div>
        <div>
          <dt>Rejected</dt>
          <dd>{summary.rejected}</dd>
        </div>
        <div>
          <dt>Expired</dt>
          <dd>{summary.expired}</dd>
        </div>
        <div>
          <dt>Average Confidence</dt>
          <dd>{summary.averageConfidencePct}%</dd>
        </div>
        <div>
          <dt>Improved Profit</dt>
          <dd className="ai-perf-positive">{summary.improvedProfitPct}%</dd>
        </div>
        <div>
          <dt>Total Est. Monthly Impact</dt>
          <dd className="ai-perf-positive">{fmt(summary.totalEstimatedMonthlyImpact)}</dd>
        </div>
        <div>
          <dt>Actual Measured Improvement</dt>
          <dd className="ai-perf-positive">{fmt(summary.actualMeasuredImprovement)}</dd>
        </div>
        <div className="ai-perf-highlight">
          <dt>AI Accuracy</dt>
          <dd>{summary.aiAccuracyPct}%</dd>
        </div>
      </dl>
    </section>
  );
}
