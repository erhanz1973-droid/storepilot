import type { AiTimelineEntry } from "@/lib/analytics/executive-advisor";

const STATUS_CLASS: Record<AiTimelineEntry["status"], string> = {
  done: "timeline-measured",
  today: "timeline-pending",
  upcoming: "timeline-info",
};

export function ExecutiveAiTimeline({ entries }: { entries: AiTimelineEntry[] }) {
  return (
    <section className="exec-advisor-timeline card">
      <h2 className="exec-advisor-section-title">AI Timeline</h2>
      <p className="muted exec-advisor-timeline-sub">
        AI is continuously monitoring, analyzing, and preparing actions for your store
      </p>
      <ol className="decision-timeline exec-advisor-timeline-list">
        {entries.map((e) => (
          <li key={e.id} className={STATUS_CLASS[e.status]}>
            <div className="timeline-date exec-advisor-timeline-row">
              <strong className="exec-advisor-timeline-time">{e.time}</strong>
              <span className="exec-advisor-timeline-event">{e.event}</span>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
