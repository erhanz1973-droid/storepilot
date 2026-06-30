import type { BeforeAfterImpact } from "@/lib/analytics/executive-ai-behavior";

function fmt(n: number) {
  const sign = n >= 0 ? "" : "-";
  return `${sign}$${Math.abs(n).toLocaleString()}`;
}

export function ExecutiveBeforeAfterCard({ impact }: { impact: BeforeAfterImpact }) {
  if (!impact.hasMeasuredOutcomes && impact.completedActions === 0) return null;

  return (
    <section className="exec-advisor-before-after card">
      <h2 className="exec-advisor-section-title">Before / After AI Actions</h2>
      <p className="muted exec-advisor-before-after-sub">
        {impact.completedActions} AI recommendation{impact.completedActions === 1 ? "" : "s"} executed
      </p>
      <div className="exec-before-after-grid">
        <div className="exec-before-after-col">
          <span className="muted">Before</span>
          <span className="exec-before-after-label">Profit</span>
          <strong className={impact.beforeProfit < 0 ? "negative" : ""}>
            {fmt(impact.beforeProfit)}/mo
          </strong>
        </div>
        <div className="exec-before-after-arrow" aria-hidden>
          →
        </div>
        <div className="exec-before-after-col">
          <span className="muted">After</span>
          <span className="exec-before-after-label">Profit</span>
          <strong className={impact.afterProfit < 0 ? "negative" : ""}>
            {fmt(impact.afterProfit)}/mo
          </strong>
        </div>
        <div className="exec-before-after-col highlight">
          <span className="muted">Improvement</span>
          <strong className="positive">+{fmt(impact.improvement)}</strong>
        </div>
      </div>
    </section>
  );
}
