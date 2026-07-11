import type { ActionPlanItem } from "@/lib/approvals/decision-center-types";

export function ActionPlanCard({ items }: { items: ActionPlanItem[] }) {
  if (items.length === 0) return null;

  return (
    <section className="decision-action-plan">
      <h5>Action Plan</h5>
      <p className="muted decision-action-plan-intro">StorePilot will perform the following actions:</p>
      <div className="decision-action-plan-cards">
        {items.map((item) => (
          <div key={`${item.target}-${item.action}`} className="decision-action-card">
            <div className="decision-action-plan-header">
              <strong>{item.target}</strong>
              <span className={`decision-action-badge decision-action-${item.actionType}`}>
                {item.action}
              </span>
            </div>

            {(item.currentRoas || item.targetRoas || item.currentProfit) && (
              <dl className="decision-action-metrics">
                {item.currentRoas && (
                  <div>
                    <dt>ROAS</dt>
                    <dd>{item.currentRoas}</dd>
                  </div>
                )}
                {item.targetRoas && (
                  <div>
                    <dt>Target</dt>
                    <dd>{item.targetRoas}</dd>
                  </div>
                )}
                {item.currentProfit && (
                  <div>
                    <dt>Current Profit</dt>
                    <dd className={item.currentProfit.includes("-") ? "decision-negative" : undefined}>
                      {item.currentProfit}
                    </dd>
                  </div>
                )}
              </dl>
            )}

            {item.currentBudget && item.newBudget && (
              <div className="decision-action-budget">
                <span>
                  <span className="muted">Current</span> {item.currentBudget}
                </span>
                <span>
                  <span className="muted">New</span> {item.newBudget}
                </span>
              </div>
            )}

            {item.reason && (
              <p className="decision-action-reason">
                <span className="muted">Reason</span> {item.reason}
              </p>
            )}

            {item.estimatedMonthlyImpact != null && item.estimatedMonthlyImpact > 0 && (
              <p className="decision-action-impact">
                <span className="muted">Expected Monthly Improvement</span>
                <strong className="decision-exec-positive">
                  +${item.estimatedMonthlyImpact.toLocaleString()}
                </strong>
              </p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
