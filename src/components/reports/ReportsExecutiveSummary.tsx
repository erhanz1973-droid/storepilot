import type { WeeklyBriefingReport } from "@/lib/reports/types";
import Link from "next/link";

function fmt(n: number) {
  const sign = n < 0 ? "-" : "";
  return `${sign}$${Math.abs(n).toLocaleString()}`;
}

const STATUS_CLASS: Record<WeeklyBriefingReport["executive"]["statusTone"], string> = {
  positive: "reports-status-positive",
  warning: "reports-status-warning",
  critical: "reports-status-critical",
};

export function ReportsExecutiveSummary({ report }: { report: WeeklyBriefingReport }) {
  const { executive: e } = report;

  return (
    <section className="reports-exec-summary card">
      <div className="reports-section-head">
        <span className="reports-section-icon" aria-hidden>
          📋
        </span>
        <div>
          <p className="reports-eyebrow">Weekly Executive Summary</p>
          <p className="muted reports-week-range">
            {report.weekStart} – {report.weekEnd}
          </p>
        </div>
      </div>

      <div className="reports-exec-metrics">
        <div>
          <p className="reports-metric-label">Revenue</p>
          <p className="reports-metric-value">{fmt(e.revenue)}</p>
        </div>
        <div>
          <p className="reports-metric-label">Net Profit</p>
          <p className={`reports-metric-value ${e.netProfit < 0 ? "negative" : "positive"}`}>
            {fmt(e.netProfit)}
          </p>
        </div>
      </div>

      <p className="reports-exec-narrative-paragraph">{e.narrativeParagraph}</p>

      <div className="reports-exec-insights">
        <p>
          <span className="reports-insight-label negative">Needs attention</span>
          {e.biggestProblem}
        </p>
        <p>
          <span className="reports-insight-label positive">Highest-impact action</span>
          {e.biggestOpportunity} — recover ~{fmt(e.opportunityImpactMonthly)}/month
        </p>
      </div>

      <div className="reports-exec-status">
        <span className="muted">Overall business status</span>
        <strong className={STATUS_CLASS[e.statusTone]}>{e.businessStatus}</strong>
      </div>

      <Link href="/decisions" className="btn btn-primary">
        Review Recommendations
      </Link>
    </section>
  );
}
