import type { SupportingMetric } from "@/lib/types";

export function MetricPills({ metrics }: { metrics: SupportingMetric[] }) {
  return (
    <div className="metrics-row">
      {metrics.map((metric) => (
        <div key={metric.label} className="metric-pill">
          <span>{metric.label}</span>
          <span>
            {metric.value}
            {metric.trend === "up" && " ↑"}
            {metric.trend === "down" && " ↓"}
          </span>
        </div>
      ))}
    </div>
  );
}
