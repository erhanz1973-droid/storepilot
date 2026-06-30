import type { CustomerHealthBreakdown } from "@/lib/customers/types";
import { CustomerDataBadge } from "@/components/customers/CustomerDataBadge";

export function CustomerHealthScorePanel({
  health,
}: {
  health: CustomerHealthBreakdown;
}) {
  if (health.status === "unavailable") {
    return (
      <div className="card customers-health-panel unavailable">
        <h3 style={{ margin: "0 0 8px" }}>Customer Health Score</h3>
        <p className="muted" style={{ margin: 0 }}>{health.explanation}</p>
      </div>
    );
  }

  return (
    <div className="card customers-health-panel">
      <div className="customers-health-header">
        <h3 style={{ margin: 0 }}>Customer Health Score</h3>
        <CustomerDataBadge status={health.status} />
      </div>
      <div className="customers-health-factors">
        {health.factors.map((factor) => (
          <div key={factor.id} className="customers-health-factor-row">
            <div className="customers-health-factor-head">
              <span>{factor.label}</span>
              <strong>{factor.score}/{factor.maxScore}</strong>
            </div>
            <div className="customers-health-factor-bar">
              <div
                className="fill"
                style={{ width: `${(factor.score / factor.maxScore) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="customers-health-overall">
        <span className="muted">Overall</span>
        <strong>{health.overall} / 100</strong>
      </div>
      <p className="muted" style={{ margin: "12px 0 0", fontSize: "0.875rem", lineHeight: 1.5 }}>
        {health.explanation}
      </p>
    </div>
  );
}
