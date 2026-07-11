import type { ExecutiveSummary } from "@/lib/approvals/decision-center-types";
import { MetricInfo } from "./MetricInfo";

function fmtMoney(n: number, showSign = true): string {
  const sign = showSign && n > 0 ? "+" : "";
  return `${sign}${n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 })}`;
}

export function ExecutiveSummarySection({ summary }: { summary: ExecutiveSummary }) {
  return (
    <section className="decision-exec-summary">
      <h5>{summary.headline}</h5>
      <p className="decision-exec-summary-scope">{summary.analysisScope}</p>
      <p className="decision-exec-summary-findings">{summary.findingsSummary}</p>
      <p className="decision-exec-summary-intro">
        By reallocating budget away from underperforming campaigns and preserving the strongest
        performers, we estimate:
      </p>
      <ul className="decision-exec-summary-metrics">
        <li>
          <span>
            Monthly profit increase <MetricInfo metricKey="estimated_profit" />
          </span>
          <strong className="decision-exec-positive">{fmtMoney(summary.estimatedProfit)}</strong>
        </li>
        {summary.adSpendChange !== 0 && (
          <li>
            <span>
              Advertising cost reduction <MetricInfo metricKey="ad_spend" />
            </span>
            <strong>{fmtMoney(summary.adSpendChange)}</strong>
          </li>
        )}
        {summary.revenueChange !== 0 && (
          <li>
            <span>Revenue impact</span>
            <strong>{fmtMoney(summary.revenueChange)}</strong>
          </li>
        )}
        {summary.roasBefore && summary.roasAfter && (
          <li>
            <span>
              Estimated ROAS improvement <MetricInfo metricKey="roas" />
            </span>
            <strong>
              {summary.roasBefore} → {summary.roasAfter}
            </strong>
          </li>
        )}
      </ul>
      <div className="decision-exec-summary-recommendation">
        <span className="muted">Overall recommendation</span>
        <strong>{summary.overallRecommendation}</strong>
      </div>
    </section>
  );
}
