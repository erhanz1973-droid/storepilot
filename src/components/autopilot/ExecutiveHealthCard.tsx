import type { ExecutiveHealthScore } from "@/lib/autopilot/types";

const DIM_LABELS: Record<keyof ExecutiveHealthScore["breakdown"], string> = {
  profitability: "Profitability",
  growth: "Growth",
  marketing: "Marketing",
  inventory: "Inventory",
  acquisition: "Acquisition",
  retention: "Retention",
  operations: "Operations",
};

export function ExecutiveHealthCard({ health }: { health: ExecutiveHealthScore }) {
  return (
    <div className="card">
      <h3>Executive Health Score</h3>
      <div className="executive-health-score">
        <strong>{health.score}</strong>
        <span>/100 · {health.label}</span>
      </div>
      <div className="health-dimensions">
        {(Object.entries(health.breakdown) as [keyof ExecutiveHealthScore["breakdown"], number][]).map(
          ([key, val]) => (
            <div key={key} className="health-dim-row">
              <span>{DIM_LABELS[key]}</span>
              <div className="health-bar-wrap">
                <div className="health-bar" style={{ width: `${val}%` }} />
              </div>
              <span>{val}</span>
            </div>
          ),
        )}
      </div>
      {health.changeReasons.length > 0 && (
        <ul className="health-reasons">
          {health.changeReasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
