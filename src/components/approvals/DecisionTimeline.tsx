import type { DecisionTimelineEvent } from "@/lib/approvals/decision-center-types";

export function DecisionTimeline({ events }: { events: DecisionTimelineEvent[] }) {
  return (
    <section className="decision-timeline" aria-label="Decision workflow">
      <ol className="decision-workflow">
        {events.map((event, i) => (
          <li
            key={`${event.label}-${i}`}
            className={[
              "decision-workflow-step",
              `is-${event.status}`,
              event.isPostApproval ? "is-post-approval" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <span className="decision-workflow-marker" aria-hidden>
              {event.status === "complete" ? "✓" : event.status === "current" ? "●" : "○"}
            </span>
            <span className="decision-workflow-label">{event.label}</span>
            {event.time && <span className="decision-workflow-time muted">{event.time}</span>}
            {i < events.length - 1 && (
              <span className="decision-workflow-arrow" aria-hidden>
                ↓
              </span>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
