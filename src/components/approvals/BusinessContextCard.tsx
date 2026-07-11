import type { BusinessContext } from "@/lib/approvals/decision-center-types";

const GOAL_LABELS: Record<string, string> = {
  increase_profit: "Increase Profit",
  increase_revenue: "Increase Revenue",
  clear_inventory: "Clear Inventory",
};

function Stars({ count }: { count: number }) {
  return <span aria-label={`${count} of 5 stars`}>{"★".repeat(count)}{"☆".repeat(5 - count)}</span>;
}

export function BusinessContextCard({ context }: { context: BusinessContext }) {
  return (
    <section className="decision-business-context">
      <div className="decision-business-selected">
        <div className="decision-business-goal">
          <span className="muted">Selected Strategy</span>
          <strong>{GOAL_LABELS[context.currentGoal] ?? context.currentGoal}</strong>
        </div>
        <div className="decision-business-alignment">
          <span className="muted">Decision Alignment</span>
          <Stars count={context.alignmentStars} />
        </div>
        <p className="decision-business-reason">
          <span className="muted">Reason</span> {context.selectedStrategyReason}
        </p>
      </div>

      <p className="muted decision-alternatives-intro">
        StorePilot evaluated these alternative strategies before recommending:
      </p>
      <div className="decision-alternatives">
        {context.alternatives.map((alt) => (
          <div key={alt.strategy} className="decision-alternative-card">
            <span className="muted">Alternative Strategy</span>
            <strong>{alt.strategy}</strong>
            <dl>
              <div>
                <dt>Expected Profit</dt>
                <dd>+${alt.expectedProfit.toLocaleString()}</dd>
              </div>
              {alt.expectedRevenue != null && (
                <div>
                  <dt>Expected Revenue</dt>
                  <dd>+${alt.expectedRevenue.toLocaleString()}</dd>
                </div>
              )}
              {alt.otherMetric && alt.otherMetricValue && (
                <div>
                  <dt>{alt.otherMetric}</dt>
                  <dd>{alt.otherMetricValue}</dd>
                </div>
              )}
            </dl>
          </div>
        ))}
      </div>
    </section>
  );
}
