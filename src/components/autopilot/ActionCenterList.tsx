import type { AutopilotAction } from "@/lib/autopilot/types";
import Link from "next/link";

const PRIORITY_CLASS: Record<AutopilotAction["priority"], string> = {
  Critical: "priority-critical",
  High: "priority-high",
  Medium: "priority-medium",
  Low: "priority-low",
};

export function ActionCenterList({
  actions,
  id,
}: {
  actions: AutopilotAction[];
  id?: string;
}) {
  if (actions.length === 0) {
    return (
      <div className="card" id={id}>
        <h3>Pending Approvals</h3>
        <p className="muted" style={{ margin: 0 }}>No actions queued — store looks stable.</p>
      </div>
    );
  }

  return (
    <div className="card" id={id}>
      <h3>Pending Approvals</h3>
      <p className="muted" style={{ marginTop: 4, marginBottom: 16, fontSize: "0.875rem" }}>
        {actions.length} action{actions.length === 1 ? "" : "s"} prioritized by expected net profit
        impact — approve in the Approval Center before anything changes.
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
            <p style={{ margin: "12px 0 0" }}>
              <Link href="/approvals" className="btn btn-secondary btn-sm">
                {a.actionLabel || "Review in Approval Center"}
              </Link>
            </p>
          </article>
        ))}
      </div>
      <p style={{ marginTop: 12, marginBottom: 0, fontSize: "0.875rem" }}>
        <Link href="/approvals" className="btn btn-primary btn-sm">
          Open Approval Center
        </Link>
      </p>
    </div>
  );
}
