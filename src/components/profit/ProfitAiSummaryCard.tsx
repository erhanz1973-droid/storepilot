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
    <div className={`card profit-ai-summary ${statusClass}`}>
      <div className="profit-ai-summary-header">
        <span className="profit-ai-label">AI Profit Summary</span>
        {summary.status !== "unavailable" && (
          <span className="profit-ai-confidence">{summary.confidencePct}% confidence</span>
        )}
      </div>
      <h2 className="profit-ai-headline">{summary.headline}</h2>
      <p className="profit-ai-reason">{summary.primaryReason}</p>

      {summary.topRecovery && (
        <div className="profit-ai-recovery">
          <div>
            <span className="muted" style={{ fontSize: "0.8rem" }}>
              Top recovery opportunity
            </span>
            <strong className="profit-ai-recovery-title">{summary.topRecovery.title}</strong>
            <p className="profit-ai-recovery-description muted" style={{ margin: "6px 0 0" }}>
              {summary.topRecovery.description}
            </p>
            <p className="profit-ai-recovery-reason muted" style={{ margin: "6px 0 0", fontSize: "0.85rem" }}>
              {summary.topRecovery.reason}
            </p>
          </div>
          <div className="profit-ai-recovery-metrics">
            <div>
              <span className="muted" style={{ fontSize: "0.75rem" }}>
                Estimated monthly improvement
              </span>
              <strong className="profit-recovery-value positive">
                +{formatMoney(summary.topRecovery.estimatedMonthlyRecovery)}
              </strong>
            </div>
            <div>
              <span className="muted" style={{ fontSize: "0.75rem" }}>
                Confidence
              </span>
              <strong>{summary.topRecovery.confidencePct}%</strong>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
