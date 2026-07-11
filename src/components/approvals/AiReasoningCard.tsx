import type { AiReasoning } from "@/lib/approvals/decision-center-types";

export function AiReasoningCard({ reasoning }: { reasoning: AiReasoning }) {
  return (
    <section className="decision-ai-reasoning">
      <h5>{reasoning.summary}</h5>
      <ul>
        {reasoning.signals.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ul>
      <p className="muted decision-ai-signal-count">
        This decision is based on {reasoning.signalCount} performance signals.
      </p>
    </section>
  );
}
