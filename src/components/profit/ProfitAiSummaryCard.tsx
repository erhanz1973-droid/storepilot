import type { ProfitAiSummary } from "@/lib/profit/profit-page-view";

function formatMoney(n: number): string {
  return n.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

export function ProfitAiSummaryCard({ summary }: { summary: ProfitAiSummary }) {
  const statusClass =
    summary.status === "verified"
      ? "profit-ai-verified"
      : summary.status === "estimated"
        ? "profit-ai-estimated"
        : "profit-ai-unavailable";

  return (
    <div className={`card profit-ai-summary profit-cfo-executive ${statusClass}`}>
      <span className="profit-ai-label">Executive Profit Summary</span>

      <div className="profit-cfo-exec-grid">
        <div>
          <span className="muted">Current Profit Status</span>
          <strong className="profit-cfo-status">{summary.profitStatus}</strong>
        </div>
        <div>
          <span className="muted">Estimated Net Profit</span>
          <strong className={summary.estimatedNetProfit < 0 ? "negative" : "positive"}>
            {formatMoney(summary.estimatedNetProfit)}
          </strong>
          <span className="muted profit-cfo-period">Last 30 days</span>
        </div>
        <div className="profit-cfo-exec-span">
          <span className="muted">Primary Reason</span>
          <p className="profit-ai-reason">{summary.primaryReason}</p>
        </div>
        {summary.biggestRecoveryTitle && (
          <div>
            <span className="muted">Biggest Recovery Opportunity</span>
            <strong>{summary.biggestRecoveryTitle}</strong>
          </div>
        )}
        {summary.estimatedMonthlyRecovery > 0 && (
          <div>
            <span className="muted">Estimated Monthly Recovery</span>
            <strong className="positive">+{formatMoney(summary.estimatedMonthlyRecovery)}</strong>
          </div>
        )}
        <div>
          <span className="muted">Confidence</span>
          <strong>
            {summary.confidenceLabel} ({summary.confidencePct}%)
          </strong>
        </div>
      </div>
    </div>
  );
}
