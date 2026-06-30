import type { AutopilotRuleView } from "@/lib/autopilot/operations-types";

function fmtImpact(n: number): string {
  if (n === 0) return "—";
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 })}/mo`;
}

const HEALTH_CLASS: Record<string, string> = {
  ready: "health-ready",
  monitoring: "health-monitoring",
  waiting: "health-waiting",
  triggered: "health-triggered",
  needs_approval: "health-approval",
  executing: "health-executing",
  completed: "health-completed",
  disabled: "health-disabled",
};

const RISK_CLASS: Record<string, string> = {
  Low: "risk-low",
  Medium: "risk-medium",
  High: "risk-high",
};

export function AutopilotRuleCard({ rule }: { rule: AutopilotRuleView }) {
  return (
    <article className={`autopilot-ops-rule-card ${rule.enabled ? "" : "is-disabled"}`}>
      <header className="autopilot-ops-rule-header">
        <div>
          <h4>{rule.title}</h4>
          <span className={`autopilot-ops-health ${HEALTH_CLASS[rule.health] ?? ""}`}>
            {rule.healthLabel}
          </span>
        </div>
        <label className="autopilot-toggle" title="Rule toggles coming soon">
          <input type="checkbox" defaultChecked={rule.enabled} disabled />
          <span>{rule.enabled ? "Enabled" : "Off"}</span>
        </label>
      </header>

      <p className="autopilot-ops-rule-summary">{rule.summary}</p>

      {rule.reason && (
        <div className="autopilot-ops-rule-reason">
          <span className="autopilot-ops-reason-label">Reason</span>
          <p>{rule.reason}</p>
        </div>
      )}

      {rule.metrics.length > 0 && (
        <dl className="autopilot-ops-rule-metrics">
          {rule.metrics.map((m) => (
            <div key={m.label}>
              <dt>{m.label}</dt>
              <dd>{m.value}</dd>
            </div>
          ))}
        </dl>
      )}

      <div className="autopilot-ops-rule-impact-grid">
        <div>
          <span className="muted">Est. monthly impact</span>
          <strong className="autopilot-ops-positive">{fmtImpact(rule.estimatedMonthlyImpact)}</strong>
        </div>
        <div>
          <span className="muted">Confidence</span>
          <strong>{rule.confidencePct}%</strong>
        </div>
        <div>
          <span className="muted">Risk</span>
          <strong className={`autopilot-ops-risk ${RISK_CLASS[rule.riskLevel] ?? ""}`}>
            {rule.riskLevel}
          </strong>
        </div>
        <div>
          <span className="muted">Triggered</span>
          <strong>{rule.actionsTriggered}</strong>
        </div>
        <div>
          <span className="muted">Pending</span>
          <strong className={rule.pendingCount > 0 ? "autopilot-ops-highlight" : undefined}>
            {rule.pendingCount}
          </strong>
        </div>
      </div>

      <details className="autopilot-ops-rule-safety">
        <summary>Safety &amp; how this rule works</summary>
        <div className="autopilot-ops-rule-safety-body">
          <p>
            <strong>What triggers it?</strong> {rule.triggerExplanation}
          </p>
          <p>
            <strong>What action is taken?</strong> {rule.actionExplanation}
          </p>
        </div>
      </details>
    </article>
  );
}
