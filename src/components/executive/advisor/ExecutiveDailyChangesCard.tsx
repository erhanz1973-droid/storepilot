import type { DailyChangeMetric } from "@/lib/analytics/executive-advisor";

function arrow(direction: DailyChangeMetric["direction"], label: string): string {
  if (label === "CPA") {
    return direction === "down" ? "▼" : direction === "up" ? "▲" : "—";
  }
  if (label === "Profit") {
    return direction === "down" ? "▼" : direction === "up" ? "▲" : "—";
  }
  return direction === "up" ? "▲" : direction === "down" ? "▼" : "—";
}

function changeClass(metric: DailyChangeMetric): string {
  if (metric.changePct == null) return "flat";
  if (metric.label === "CPA" || metric.label === "Profit") {
    return metric.direction === "down" ? "negative" : metric.direction === "up" ? "positive" : "flat";
  }
  return metric.direction === "up" ? "positive" : metric.direction === "down" ? "negative" : "flat";
}

export function ExecutiveDailyChangesCard({ changes }: { changes: DailyChangeMetric[] }) {
  return (
    <section className="exec-advisor-daily card">
      <h2 className="exec-advisor-section-title">Since Yesterday</h2>
      <div className="exec-advisor-daily-grid">
        {changes.map((m) => (
          <div key={m.id} className={`exec-advisor-daily-item ${changeClass(m)}`}>
            <span className="exec-advisor-daily-label">{m.label}</span>
            <span className="exec-advisor-daily-value">
              {arrow(m.direction, m.label)}
              {m.formatted}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
