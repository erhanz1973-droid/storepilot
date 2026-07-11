import Link from "next/link";
import type { AutopilotHistoryItem } from "@/lib/autopilot/operations-types";

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

export function AutopilotHistoryPanel({ history }: { history: AutopilotHistoryItem[] }) {
  return (
    <section className="card autopilot-ops-history-card">
      <div className="autopilot-ops-history-header">
        <div>
          <h3>Automation History</h3>
          <p className="muted" style={{ margin: "4px 0 0", fontSize: "0.875rem" }}>
            Recent decisions StorePilot prepared or completed on your behalf.
          </p>
        </div>
        <Link href="/approvals" className="btn btn-secondary btn-sm">
          Approval Center
        </Link>
      </div>
      <ol className="autopilot-ops-history-list">
        {history.map((item) => (
          <li key={item.id}>
            <span className="autopilot-ops-history-day">{item.dayLabel}</span>
            <span className="autopilot-ops-history-title">{item.title}</span>
            <span
              className={`autopilot-ops-health autopilot-ops-history-status ${HEALTH_CLASS[item.status] ?? ""}`}
            >
              {item.statusLabel}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
