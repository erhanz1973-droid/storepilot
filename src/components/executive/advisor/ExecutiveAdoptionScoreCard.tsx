import type { ExecutiveAdoptionScore } from "@/lib/analytics/executive-ai-behavior";

function fmt(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export function ExecutiveAdoptionScoreCard({ score }: { score: ExecutiveAdoptionScore }) {
  return (
    <section className="exec-advisor-adoption card">
      <h2 className="exec-advisor-section-title">AI Adoption Score</h2>
      <div className="exec-adoption-hero">
        <span className="exec-adoption-pct">{score.scorePct}%</span>
        <p className="muted">How actively you use AI recommendations</p>
      </div>
      <div className="exec-adoption-grid">
        <div>
          <span className="muted">Recommendations Completed</span>
          <strong>
            {score.completedCount} / {score.totalCount}
          </strong>
        </div>
        <div>
          <span className="muted">Average Response Time</span>
          <strong>{score.avgResponseHours} hours</strong>
        </div>
        <div>
          <span className="muted">Est. Profit Recovered</span>
          <strong className="positive">{fmt(score.profitRecoveredMonthly)}</strong>
        </div>
      </div>
    </section>
  );
}
