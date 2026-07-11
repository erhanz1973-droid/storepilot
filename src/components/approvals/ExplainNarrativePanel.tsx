import type { ExplainNarrative } from "@/lib/approvals/decision-center-types";

export function ExplainNarrativePanel({
  narrative,
  onClose,
}: {
  narrative: ExplainNarrative;
  onClose: () => void;
}) {
  return (
    <section className="decision-explain-narrative">
      <div className="decision-explain-narrative-header">
        <h5>{narrative.question}</h5>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
          Close
        </button>
      </div>
      {narrative.paragraphs.map((p) => (
        <p key={p}>{p}</p>
      ))}
      <p className="muted decision-explain-narrative-footnote">
        This recommendation is based on {narrative.signalCount} analyzed signals.
      </p>
    </section>
  );
}
