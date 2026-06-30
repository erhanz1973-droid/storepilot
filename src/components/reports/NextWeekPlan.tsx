import type { NextWeekPriority } from "@/lib/reports/types";
import Link from "next/link";

export function NextWeekPlan({ priorities }: { priorities: NextWeekPriority[] }) {
  return (
    <section className="card reports-next-week">
      <div className="reports-section-head">
        <span className="reports-section-icon" aria-hidden>
          🎯
        </span>
        <h3>Next Week Priorities</h3>
      </div>
      <p className="muted" style={{ margin: "0 0 14px", fontSize: "0.88rem" }}>
        Your action plan for the coming week — start here if you only read one section besides the
        executive summary.
      </p>
      <ol className="reports-plan-list">
        {priorities.map((p) => (
          <li key={p.priority}>
            <div className="reports-plan-priority">Priority {p.priority}</div>
            <div className="reports-plan-body">
              <strong>{p.title}</strong>
              {p.metricLabel && p.metricValue && (
                <span className="reports-plan-metric">
                  {p.metricLabel}: <em>{p.metricValue}</em>
                </span>
              )}
              <span className="reports-plan-impact">
                {p.impactLabel.startsWith("Expected") || p.impactLabel.startsWith("+")
                  ? p.impactLabel
                  : `Expected impact: ${p.impactLabel}`}
              </span>
            </div>
          </li>
        ))}
      </ol>
      <Link href="/approvals" className="btn btn-primary">
        Open Approval Center
      </Link>
    </section>
  );
}
