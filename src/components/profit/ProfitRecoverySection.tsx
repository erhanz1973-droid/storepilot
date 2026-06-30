import type { ProfitPageView } from "@/lib/profit/profit-page-view";

function formatMoney(n: number): string {
  return n.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

export function ProfitRecoverySection({
  recovery,
}: {
  recovery: ProfitPageView["recovery"];
}) {
  if (recovery.opportunities.length === 0) return null;

  return (
    <div className="card profit-recovery-section">
      <div className="profit-recovery-header">
        <div>
          <h3 style={{ margin: 0 }}>Recovery Opportunities</h3>
          <p className="muted" style={{ margin: "4px 0 0", fontSize: "0.875rem" }}>
            Ranked by expected impact — optimization first, pause only as a last resort
          </p>
        </div>
        <div className="profit-recovery-total">
          <span className="muted" style={{ fontSize: "0.75rem" }}>
            Estimated Monthly Recovery
          </span>
          <strong className="profit-recovery-value positive">
            +{formatMoney(recovery.totalMonthlyRecovery)}
          </strong>
        </div>
      </div>

      <div className="profit-recovery-list">
        {recovery.opportunities.map((opp) => (
          <div
            key={opp.id}
            className={`profit-recovery-item ${opp.isLastResort ? "profit-recovery-last-resort" : ""}`}
          >
            <div className="profit-recovery-item-main">
              <div className="profit-recovery-item-header">
                <span className="profit-recovery-rank">{opp.rank}.</span>
                <strong>{opp.title}</strong>
                <span className="profit-recovery-priority">{opp.priorityLabel}</span>
              </div>
              <p className="profit-recovery-description">{opp.description}</p>
              <p className="profit-recovery-reason muted">
                <strong>Reason:</strong> {opp.reason}
              </p>
            </div>
            <div className="profit-recovery-item-metrics">
              <strong className="positive">+{formatMoney(opp.estimatedMonthlyRecovery)}</strong>
              <span className="muted">{opp.confidencePct}% confidence</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
