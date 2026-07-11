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
    <div className="card profit-recovery-section profit-recovery-plan">
      <div className="profit-recovery-header">
        <div>
          <h3 style={{ margin: 0 }}>Financial Recovery Plan</h3>
          <p className="muted" style={{ margin: "4px 0 0", fontSize: "0.875rem" }}>
            Prioritized actions ranked by expected profit recovery
          </p>
        </div>
        <div className="profit-recovery-total">
          <span className="muted" style={{ fontSize: "0.75rem" }}>
            Total Recoverable
          </span>
          <strong className="profit-recovery-value positive">
            +{formatMoney(recovery.totalMonthlyRecovery)}/month
          </strong>
        </div>
      </div>

      <div className="profit-recovery-list">
        {recovery.opportunities.map((opp) => (
          <article
            key={opp.id}
            className={`profit-recovery-item profit-recovery-plan-item ${opp.isLastResort ? "profit-recovery-last-resort" : ""}`}
          >
            <span className="profit-recovery-plan-priority">Priority {opp.rank}</span>
            <h4 className="profit-recovery-plan-title">{opp.title}</h4>
            <p className="profit-recovery-description">{opp.description}</p>

            <div className="profit-recovery-plan-metrics">
              <div>
                <span className="muted">Estimated Profit Recovery</span>
                <strong className="positive">+{formatMoney(opp.estimatedMonthlyRecovery)}/month</strong>
              </div>
              <div>
                <span className="muted">Difficulty</span>
                <strong>{opp.difficulty}</strong>
              </div>
              <div>
                <span className="muted">Time Required</span>
                <strong>{opp.timeRequired}</strong>
              </div>
              <div>
                <span className="muted">Confidence</span>
                <strong>{opp.confidencePct}%</strong>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
