import type { StoreHealthScore } from "@/lib/store-health/score";

function scoreColor(score: number): string {
  if (score >= 85) return "var(--low)";
  if (score >= 65) return "var(--medium)";
  if (score >= 45) return "var(--high)";
  return "var(--critical)";
}

export function StoreHealthScoreCard({ health }: { health: StoreHealthScore }) {
  const color = scoreColor(health.score);

  return (
    <div className="card store-health-card">
      <h3>Store Health</h3>
      <div className="health-score">
        <div className="health-ring" style={{ borderColor: color }}>
          <span className="health-ring-value">{health.score}</span>
          <span className="health-ring-max">/ 100</span>
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ margin: "0 0 8px", fontWeight: 600, color }}>
            {health.label}
            {health.previousScore != null && (
              <span className="muted" style={{ fontWeight: 400, marginLeft: 8, fontSize: "0.85rem" }}>
                {health.score > health.previousScore ? "+" : ""}
                {health.score - health.previousScore} vs yesterday
              </span>
            )}
          </p>
          {health.factors.map((f) => (
            <div key={f.factor} className="breakdown-row">
              <span>{f.label}</span>
              <span style={{ fontWeight: 600, color: scoreColor(f.score) }}>{f.score}</span>
            </div>
          ))}
        </div>
      </div>

      {health.changes.length > 0 && (
        <div className="health-changes" style={{ marginTop: 16 }}>
          <p className="muted" style={{ margin: "0 0 8px", fontSize: "0.85rem", fontWeight: 600 }}>
            Score changes
          </p>
          <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
            {health.changes.map((c, i) => (
              <li key={i} className="health-change-row">
                <span
                  className={c.delta > 0 ? "health-change-up" : "health-change-down"}
                  style={{ fontWeight: 700, minWidth: 32 }}
                >
                  {c.delta > 0 ? "+" : ""}
                  {c.delta}
                </span>
                <span style={{ fontSize: "0.875rem" }}>{c.reason}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
