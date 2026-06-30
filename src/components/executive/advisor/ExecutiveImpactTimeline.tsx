import type { ImpactTimeline } from "@/lib/analytics/executive-advisor";

function fmt(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export function ExecutiveImpactTimeline({
  timeline,
  prefix = "-",
  compact = false,
}: {
  timeline: ImpactTimeline;
  prefix?: "-" | "+";
  compact?: boolean;
}) {
  return (
    <div className={`exec-advisor-impact-timeline ${compact ? "compact" : ""}`}>
      <div className="exec-advisor-impact-item">
        <span className="exec-advisor-impact-period">Today</span>
        <strong>
          {prefix}
          {fmt(timeline.daily)}/day
        </strong>
      </div>
      <div className="exec-advisor-impact-item">
        <span className="exec-advisor-impact-period">7 Days</span>
        <strong>
          {prefix}
          {fmt(timeline.weekly)}
        </strong>
      </div>
      <div className="exec-advisor-impact-item">
        <span className="exec-advisor-impact-period">30 Days</span>
        <strong>
          {prefix}
          {fmt(timeline.monthly)}
        </strong>
      </div>
    </div>
  );
}
