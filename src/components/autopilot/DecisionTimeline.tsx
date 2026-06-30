import type { TimelineEntry } from "@/lib/autopilot/types";

export function DecisionTimeline({ entries }: { entries: TimelineEntry[] }) {
  return (
    <div className="card">
      <h3>AI Decision Timeline</h3>
      <p className="muted" style={{ marginTop: 4, marginBottom: 12, fontSize: "0.875rem" }}>
        Recommendations accepted, rejected, and measured outcomes
      </p>
      <ol className="decision-timeline">
        {entries.map((e) => (
          <li key={e.id} className={`timeline-${e.status}`}>
            <div className="timeline-date">
              <strong>{e.dayLabel}</strong>
              <span className="muted">{e.date}</span>
            </div>
            <p style={{ margin: "4px 0" }}>{e.event}</p>
            {e.outcome && (
              <p className="muted" style={{ margin: 0, fontSize: "0.875rem" }}>
                {e.outcome}
                {e.impactPct != null && ` · +${e.impactPct}% impact`}
              </p>
            )}
            <span className={`timeline-status timeline-status-${e.status}`}>{e.status}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
