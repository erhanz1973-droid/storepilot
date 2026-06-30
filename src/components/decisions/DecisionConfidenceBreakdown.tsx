import type { DecisionConfidenceBreakdown } from "@/lib/decisions/engine/types";

const STATUS_ICON: Record<string, string> = {
  pass: "✓",
  warn: "⚠",
  fail: "✗",
  missing: "⚠",
};

const STATUS_COLOR: Record<string, string> = {
  pass: "#22c55e",
  warn: "#eab308",
  fail: "#ef4444",
  missing: "#94a3b8",
};

type Props = {
  breakdown: DecisionConfidenceBreakdown;
};

export function DecisionConfidenceBreakdownPanel({ breakdown }: Props) {
  return (
    <div className="decision-card-section" style={{ marginTop: 12 }}>
      <p className="decision-section-label">Confidence — {breakdown.overallPct}%</p>
      <p className="muted" style={{ fontSize: "0.82rem", margin: "0 0 10px" }}>
        Calculated from
      </p>
      <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
        {breakdown.components.map((item) => (
          <li
            key={item.label}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              fontSize: "0.85rem",
              marginBottom: 6,
            }}
          >
            <span>
              <span style={{ color: STATUS_COLOR[item.status], marginRight: 6 }}>
                {STATUS_ICON[item.status]}
              </span>
              {item.label}
              {item.detail ? (
                <span className="muted" style={{ marginLeft: 6 }}>
                  — {item.detail}
                </span>
              ) : null}
            </span>
            <strong>{item.status === "missing" ? "—" : `${item.scorePct}%`}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}
