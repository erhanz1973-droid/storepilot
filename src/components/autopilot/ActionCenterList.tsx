import type { AutopilotAction } from "@/lib/autopilot/types";
import Link from "next/link";

const PRIORITY_CLASS: Record<AutopilotAction["priority"], string> = {
  Critical: "priority-critical",
  High: "priority-high",
  Medium: "priority-medium",
  Low: "priority-low",
};

export function ActionCenterList({ actions }: { actions: AutopilotAction[] }) {
  if (actions.length === 0) {
    return (
      <div className="card">
        <h3>AI Action Center</h3>
        <p className="muted" style={{ margin: 0 }}>No actions queued — store looks stable.</p>
      </div>
    );
  }

  return (
    <div className="card">
      <h3>AI Action Center</h3>
      <p className="muted" style={{ marginTop: 4, marginBottom: 16, fontSize: "0.875rem" }}>
        Prioritized by expected net profit impact
      </p>
      <div className="action-queue">
        {actions.map((a, i) => (
          <article key={a.id} className="action-card">
            <div className="action-card-top">
              <span className="action-rank">#{i + 1}</span>
              <span className={`priority-pill ${PRIORITY_CLASS[a.priority]}`}>{a.priority}</span>
              <span className="muted" style={{ fontSize: "0.75rem" }}>~{a.estimatedMinutes} min</span>
            </div>
            <h4>{a.title}</h4>
            <p className="muted action-desc">{a.description}</p>
            <div className="action-impact">
              <div>
                <span className="muted">Expected profit gain</span>
                <strong className="positive">
                  +${a.expectedNetProfitGain.toLocaleString()}/mo
                </strong>
              </div>
              <div>
                <span className="muted">Confidence</span>
                <strong>{Math.round(a.confidenceScore * 100)}%</strong>
              </div>
            </div>
            <p className="muted" style={{ margin: "8px 0 0", fontSize: "0.8125rem" }}>
              {a.businessImpact}
            </p>
          </article>
        ))}
      </div>
      <p style={{ marginTop: 12, marginBottom: 0, fontSize: "0.875rem" }}>
        <Link href="/approvals">Approval Center</Link> to accept or snooze actions
      </p>
    </div>
  );
}
