import type { StoreInsight } from "@/lib/insights/types";

const PRIORITY_BADGE: Record<StoreInsight["priority"], string> = {
  critical: "badge-critical",
  high: "badge-high",
  medium: "badge-medium",
  low: "badge-low",
};

export function InsightCard({ insight, compact }: { insight: StoreInsight; compact?: boolean }) {
  return (
    <article className="insight-card" style={{ padding: compact ? "12px 0" : "16px", borderBottom: compact ? "1px solid var(--border)" : undefined }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
        <div>
          <span className={`badge ${PRIORITY_BADGE[insight.priority]}`} style={{ marginBottom: 8, display: "inline-block" }}>
            {insight.priority}
          </span>
          <h4 style={{ margin: "0 0 6px", fontSize: compact ? "0.95rem" : "1rem" }}>{insight.title}</h4>
          <p className="muted" style={{ margin: "0 0 8px", fontSize: "0.9rem" }}>{insight.summary}</p>
          <p style={{ margin: 0, fontSize: "0.9rem" }}>
            <strong>Recommendation:</strong> {insight.recommendation}
          </p>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: "1.25rem", fontWeight: 700 }}>{insight.confidence}%</div>
          <div className="muted" style={{ fontSize: "0.75rem" }}>confidence</div>
        </div>
      </div>

      {!compact && insight.why.length > 0 && (
        <details style={{ marginTop: 12 }}>
          <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: "0.9rem" }}>Why?</summary>
          <ul style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: "0.875rem" }}>
            {insight.why.map((w) => (
              <li key={w.label} style={{ marginBottom: 4 }}>
                <strong>{w.label}:</strong> {w.value}
                {w.trend === "up" ? " ↑" : w.trend === "down" ? " ↓" : ""}
              </li>
            ))}
          </ul>
          <p className="muted" style={{ margin: "8px 0 0", fontSize: "0.8rem" }}>
            Confidence: {insight.confidence}% — based on synced store and ads data.
          </p>
        </details>
      )}
    </article>
  );
}
