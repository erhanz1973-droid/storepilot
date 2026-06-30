import Link from "next/link";
import type { AutopilotSection } from "@/lib/analytics/executive-advisor";

function fmt(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export function ExecutiveAutopilotSection({ autopilot }: { autopilot: AutopilotSection }) {
  if (autopilot.pendingCount === 0) return null;

  return (
    <section className="exec-advisor-autopilot card">
      <div className="exec-advisor-autopilot-header">
        <div>
          <p className="exec-advisor-autopilot-badge">Premium</p>
          <h2 className="exec-advisor-section-title">AI Autopilot</h2>
        </div>
        <div className="exec-advisor-autopilot-stats">
          <span className="exec-advisor-autopilot-count">
            {autopilot.pendingCount} action{autopilot.pendingCount === 1 ? "" : "s"} waiting approval
          </span>
          <span className="exec-advisor-autopilot-recovery">
            Expected Recovery: <strong>+{fmt(autopilot.expectedRecoveryMonthly)}/month</strong>
          </span>
        </div>
      </div>
      <div className="exec-advisor-autopilot-actions">
        <Link href="/decisions?approve=all" className="btn btn-primary">
          Approve All
        </Link>
        <Link href="/decisions" className="btn btn-secondary">
          Review Individually
        </Link>
      </div>
    </section>
  );
}
