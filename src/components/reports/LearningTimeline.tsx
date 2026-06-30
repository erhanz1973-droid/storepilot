import type { TimelineEvent, TimelineEventType } from "@/lib/reports/types";

const TYPE_META: Record<TimelineEventType, { icon: string; label: string }> = {
  observation: { icon: "👁", label: "Observation" },
  recommendation: { icon: "💡", label: "Recommendation" },
  approval: { icon: "✓", label: "Approval" },
  execution: { icon: "⚡", label: "Execution" },
  measurement: { icon: "📈", label: "Measurement" },
};

export function LearningTimeline({ events }: { events: TimelineEvent[] }) {
  return (
    <section className="card reports-timeline">
      <div className="reports-section-head">
        <span className="reports-section-icon" aria-hidden>
          📅
        </span>
        <h3>Learning Timeline</h3>
      </div>
      <p className="muted" style={{ margin: "0 0 12px", fontSize: "0.85rem" }}>
        Observations, recommendations, approvals, and measured outcomes — separated for clarity.
      </p>
      <ol className="reports-timeline-list">
        {events.map((e, i) => {
          const meta = TYPE_META[e.type];
          return (
            <li key={`${e.day}-${i}`} className={e.tone ? `tone-${e.tone}` : ""}>
              <span className="reports-timeline-type" title={meta.label}>
                <span aria-hidden>{meta.icon}</span>
                <span className="reports-timeline-type-label">{meta.label}</span>
              </span>
              <span className="reports-timeline-day">{e.day}</span>
              <span className="reports-timeline-label">{e.label}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
