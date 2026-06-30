import type { ExecutiveDecisionBriefing } from "@/lib/approvals/decision-center-types";

function fmt(n: number): string {
  if (n <= 0) return "—";
  return `+${n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 })}`;
}

export function ExecutiveDecisionBriefingCard({ briefing }: { briefing: ExecutiveDecisionBriefing }) {
  return (
    <section className="card decision-exec-briefing">
      <p className="decision-exec-eyebrow">AI Decision Center</p>
      <h3>Today&apos;s Executive Briefing</h3>

      <div className="decision-exec-status-row">
        <div className="decision-exec-status">
          <span className="muted">Business Status</span>
          <strong>
            {briefing.businessStatus.emoji} {briefing.businessStatus.label}
          </strong>
          <p className="muted decision-exec-status-copy">{briefing.businessStatus.summary}</p>
        </div>

        {briefing.topOpportunityTitle && (
          <div className="decision-exec-top-opp">
            <span className="muted">Highest Impact Opportunity</span>
            <strong>{briefing.topOpportunityTitle}</strong>
            <div className="decision-exec-top-metrics">
              <div>
                <span className="muted">Est. Monthly Profit</span>
                <strong className="decision-exec-positive">{fmt(briefing.topOpportunityImpact)}</strong>
              </div>
              <div>
                <span className="muted">Confidence</span>
                <strong>{briefing.topOpportunityConfidencePct}%</strong>
              </div>
            </div>
          </div>
        )}
      </div>

      <dl className="decision-exec-stats">
        <div>
          <dt>Urgent Decisions</dt>
          <dd className={briefing.urgentDecisions > 0 ? "decision-exec-urgent" : undefined}>
            {briefing.urgentDecisions}
          </dd>
        </div>
        <div>
          <dt>Pending Decisions</dt>
          <dd>{briefing.pendingDecisions}</dd>
        </div>
        <div>
          <dt>Completed Today</dt>
          <dd>{briefing.completedToday}</dd>
        </div>
      </dl>

      <div className="decision-exec-narrative">
        <p>{briefing.narrative}</p>
      </div>
    </section>
  );
}
