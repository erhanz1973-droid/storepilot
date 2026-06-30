import type { StrategyWinnerExplanation } from "@/lib/decisions/engine/types";

function formatUsd(amount: number): string {
  return amount.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

type Props = {
  explanation: StrategyWinnerExplanation;
};

export function DecisionStrategyComparison({ explanation }: Props) {
  return (
    <div
      className="decision-card-section"
      style={{
        marginTop: 12,
        padding: 14,
        borderRadius: 10,
        background: "rgba(34,197,94,0.06)",
        border: "1px solid rgba(34,197,94,0.15)",
      }}
    >
      <p className="decision-section-label">Why this strategy?</p>
      <p style={{ margin: "0 0 12px", fontWeight: 600 }}>
        Recommended: {explanation.recommendedLabel}
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
          gap: 10,
          marginBottom: 12,
        }}
      >
        <div>
          <p className="muted" style={{ margin: 0, fontSize: "0.75rem" }}>
            Expected Net Profit
          </p>
          <strong>{formatUsd(explanation.recommendedNetProfit)}</strong>
        </div>
        {explanation.runnerUpLabel && explanation.runnerUpNetProfit != null && (
          <div>
            <p className="muted" style={{ margin: 0, fontSize: "0.75rem" }}>
              {explanation.runnerUpLabel}
            </p>
            <strong>{formatUsd(explanation.runnerUpNetProfit)}</strong>
          </div>
        )}
        {explanation.profitDifference != null && explanation.profitDifference > 0 && (
          <div>
            <p className="muted" style={{ margin: 0, fontSize: "0.75rem" }}>
              Difference
            </p>
            <strong style={{ color: "#22c55e" }}>
              +{formatUsd(explanation.profitDifference)}
            </strong>
          </div>
        )}
      </div>

      <ul style={{ margin: 0, paddingLeft: 18, fontSize: "0.88rem", lineHeight: 1.5 }}>
        {explanation.businessReasons.map((reason) => (
          <li key={reason.slice(0, 40)} style={{ marginBottom: 4 }}>
            {reason}
          </li>
        ))}
      </ul>
    </div>
  );
}
