import type { AutopilotAlert } from "@/lib/autopilot/types";

const SEV_CLASS: Record<AutopilotAlert["severity"], string> = {
  Critical: "priority-critical",
  High: "priority-high",
  Medium: "priority-medium",
  Low: "priority-low",
};

export function AlertCenterList({ alerts }: { alerts: AutopilotAlert[] }) {
  if (alerts.length === 0) {
    return (
      <div className="card">
        <h3>Alert Center</h3>
        <p className="muted" style={{ margin: 0 }}>No active alerts.</p>
      </div>
    );
  }

  return (
    <div className="card">
      <h3>Alert Center</h3>
      <ul className="alert-list">
        {alerts.map((a) => (
          <li key={a.id} className="alert-item">
            <div className="alert-item-header">
              <span className={`priority-pill ${SEV_CLASS[a.severity]}`}>{a.severity}</span>
              <strong>{a.title}</strong>
            </div>
            <p className="muted" style={{ margin: "4px 0" }}>{a.reason}</p>
            <p style={{ margin: "4px 0", fontSize: "0.875rem" }}>
              <strong>Impact:</strong> {a.businessImpact}
            </p>
            <p style={{ margin: "4px 0 0", fontSize: "0.875rem", color: "var(--accent)" }}>
              → {a.suggestedAction}
            </p>
            <span className="muted" style={{ fontSize: "0.75rem" }}>
              {Math.round(a.confidenceScore * 100)}% confidence
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
