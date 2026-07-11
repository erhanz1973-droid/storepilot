import Link from "next/link";
import type { AutopilotStatusSummary } from "@/lib/autopilot/operations-types";

function fmtImpact(n: number): string {
  if (n === 0) return "$0";
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 })}`;
}

export function AutopilotStatusCard({ status }: { status: AutopilotStatusSummary }) {
  return (
    <section className="card autopilot-ops-status-card">
      <div className="autopilot-ops-status-header">
        <div>
          <p className="autopilot-ops-eyebrow">AI Operations Center</p>
          <h3 className="autopilot-ops-status-title">Autopilot Status</h3>
          <p className="muted autopilot-ops-status-sub">
            What StorePilot is deciding for you today — outcomes before configuration.
          </p>
        </div>
        {status.pendingApprovals > 0 && (
          <Link href="#pending-actions" className="btn btn-primary btn-sm">
            Review {status.pendingApprovals} pending
          </Link>
        )}
      </div>
      <dl className="autopilot-ops-status-grid">
        <div>
          <dt>Active Rules</dt>
          <dd>{status.activeRules}</dd>
        </div>
        <div>
          <dt>Pending Approvals</dt>
          <dd className={status.pendingApprovals > 0 ? "autopilot-ops-highlight" : undefined}>
            {status.pendingApprovals}
          </dd>
        </div>
        <div>
          <dt>Estimated Monthly Impact</dt>
          <dd className="autopilot-ops-positive">{fmtImpact(status.estimatedMonthlyImpact)}</dd>
        </div>
        <div>
          <dt>Last Action</dt>
          <dd className="autopilot-ops-last-action">{status.lastAction}</dd>
        </div>
        <div>
          <dt>Last Review</dt>
          <dd>{status.lastReviewLabel}</dd>
        </div>
      </dl>
    </section>
  );
}
