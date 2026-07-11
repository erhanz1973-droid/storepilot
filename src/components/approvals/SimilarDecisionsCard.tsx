import type { SimilarDecision } from "@/lib/approvals/decision-center-types";

export function SimilarDecisionsCard({ decisions }: { decisions: SimilarDecision[] }) {
  if (decisions.length === 0) return null;

  return (
    <section className="decision-similar-card">
      <h5>Previous Similar Decisions</h5>
      <p className="muted decision-similar-intro">
        Measured outcomes from decisions you approved previously.
      </p>
      <ul className="decision-similar-list">
        {decisions.map((d) => (
          <li key={`${d.periodLabel}-${d.title}`}>
            <span className="decision-similar-period">{d.periodLabel}</span>
            <span className="decision-similar-title">{d.title}</span>
            <strong className="decision-similar-result">{d.resultLabel}</strong>
          </li>
        ))}
      </ul>
    </section>
  );
}
