import type { DecisionExplainability } from "@/lib/decisions/engine/types";

type Props = {
  explainability: DecisionExplainability;
};

export function DecisionExplainabilityBadge({ explainability }: Props) {
  const evidenceLabel =
    explainability.evidenceStatus === "complete"
      ? "Complete"
      : explainability.evidenceStatus === "partial"
        ? "Partial"
        : "Minimal";

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "4px 10px",
        borderRadius: 999,
        fontSize: "0.78rem",
        background: "rgba(99,102,241,0.12)",
        border: "1px solid rgba(99,102,241,0.2)",
      }}
    >
      <span>
        Explainability <strong>{explainability.scorePct}%</strong>
      </span>
      <span className="muted">·</span>
      <span className="muted">Evidence {evidenceLabel}</span>
    </div>
  );
}
