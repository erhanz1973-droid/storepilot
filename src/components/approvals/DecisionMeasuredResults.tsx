import type { DecisionMeasuredOutcome } from "@/lib/approvals/decision-center-types";

function fmt(n: number): string {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export function DecisionMeasuredResults({ outcome }: { outcome: DecisionMeasuredOutcome }) {
  return (
    <div className="decision-measured-results">
      <h5>Recommendation Completed</h5>
      <dl className="decision-measured-grid">
        <div>
          <dt>Expected Profit</dt>
          <dd>+{fmt(outcome.expectedMonthlyProfit)}/month</dd>
        </div>
        <div>
          <dt>Actual Result ({outcome.windowDays} Days)</dt>
          <dd>
            {outcome.actualMonthlyProfit != null
              ? `+${fmt(outcome.actualMonthlyProfit)}/month`
              : "—"}
          </dd>
        </div>
        <div>
          <dt>Accuracy</dt>
          <dd>{outcome.accuracyPct != null ? `${outcome.accuracyPct}%` : "—"}</dd>
        </div>
      </dl>
      {outcome.summary && <p className="muted">{outcome.summary}</p>}
    </div>
  );
}
