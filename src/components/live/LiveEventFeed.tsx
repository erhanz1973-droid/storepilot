import Link from "next/link";
import type { MergedLiveEvent } from "@/lib/live/event-merge";

const PRIORITY_META: Record<
  MergedLiveEvent["priority"],
  { emoji: string; label: string; className: string }
> = {
  critical: { emoji: "🔴", label: "Critical", className: "event-critical" },
  warning: { emoji: "🟡", label: "Warning", className: "event-warning" },
  positive: { emoji: "🟢", label: "Positive", className: "event-positive" },
  info: { emoji: "🔵", label: "Information", className: "event-info" },
};

export function LiveEventFeed({ events }: { events: MergedLiveEvent[] }) {
  return (
    <section className="card">
      <h3>Live Events</h3>
      <p className="muted" style={{ margin: "4px 0 12px", fontSize: "0.85rem" }}>
        One issue per event — prioritized by business impact
      </p>
      {events.length === 0 ? (
        <p className="muted">StorePilot is monitoring — no active signals right now.</p>
      ) : (
        <ul className="live-event-feed">
          {events.map((event) => {
            const meta = PRIORITY_META[event.priority];
            return (
              <li key={event.id} className={`live-event-card ${meta.className}`}>
                <div className="live-event-header">
                  <span className="live-event-priority">
                    {meta.emoji} {meta.label}
                  </span>
                  <span className="muted live-event-time">Detected {event.detectedLabel}</span>
                </div>
                <strong className="live-event-title">{event.title}</strong>
                {event.subtitle && event.subtitle !== event.title && (
                  <p className="muted live-event-subtitle">{event.subtitle}</p>
                )}
                <p className="live-event-desc">{event.description}</p>
                {event.evidence.length > 0 && (
                  <ul className="live-event-evidence">
                    {event.evidence.map((e) => (
                      <li key={`${e.label}-${e.value}`}>
                        {e.label}: <strong>{e.value}</strong>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="live-event-footer">
                  <span className="muted">Confidence {event.confidencePct}%</span>
                  {event.recommendedActions.length > 0 && (
                    <div className="live-event-actions">
                      <span className="muted">Recommended</span>
                      <ul>
                        {event.recommendedActions.map((a) => (
                          <li key={a}>{a}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {event.viewHref && (
                    <Link href={event.viewHref} className="btn btn-ghost btn-sm">
                      View details
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
