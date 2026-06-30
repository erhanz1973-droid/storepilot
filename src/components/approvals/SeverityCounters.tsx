import type { RecommendationSeverity } from "@/lib/types";

const LABELS: Record<RecommendationSeverity, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

const COLORS: Record<RecommendationSeverity, string> = {
  critical: "var(--critical)",
  high: "var(--high)",
  medium: "var(--medium)",
  low: "var(--low)",
};

export function SeverityCounters({
  counts,
}: {
  counts: Record<RecommendationSeverity, number>;
}) {
  return (
    <div className="severity-counters">
      {(Object.keys(counts) as RecommendationSeverity[]).map((severity) => (
        <div key={severity} className="severity-counter">
          <span className="severity-counter-value" style={{ color: COLORS[severity] }}>
            {counts[severity]}
          </span>
          <span className="muted">{LABELS[severity]}</span>
        </div>
      ))}
    </div>
  );
}
