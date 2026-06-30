import Link from "next/link";
import type { ExecutiveOpportunity } from "@/lib/analytics/executive-experience";

export function TodaysOpportunitiesPanel({ opportunities }: { opportunities: ExecutiveOpportunity[] }) {
  const items = opportunities.slice(0, 5);

  return (
    <section className="exec-opportunities">
      <div className="analytics-section-header">
        <h3>Today&apos;s Opportunities</h3>
        <Link href="/decisions" className="muted">
          View all →
        </Link>
      </div>
      <ul className="exec-opportunity-list">
        {items.map((opp) => (
          <li key={opp.id} className="exec-opportunity-item card">
            <div className="exec-opportunity-check" aria-hidden>
              ✓
            </div>
            <div className="exec-opportunity-body">
              <p className="exec-opportunity-title">{opp.title}</p>
              <p className="exec-opportunity-impact">
                Estimated impact: <strong>{opp.impactLabel}</strong>
              </p>
              <p className="muted exec-opportunity-confidence">{opp.confidencePct}% confidence</p>
            </div>
            <Link href={opp.decisionId ? `/decisions#${opp.decisionId}` : "/decisions"} className="btn btn-ghost exec-opportunity-btn">
              Review
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
