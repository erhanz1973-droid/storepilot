import type { FinancialImpactExplanation } from "@/lib/approvals/decision-center-types";

export function FinancialImpactExplanationPanel({
  explanation,
}: {
  explanation: FinancialImpactExplanation;
}) {
  return (
    <section className="decision-financial-explanation">
      <h5>{explanation.title}</h5>
      {explanation.paragraphs.map((p) => (
        <p key={p}>{p}</p>
      ))}
      <div className="decision-financial-result">
        <span className="muted">Result</span>
        <ul>
          {explanation.bullets.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}
