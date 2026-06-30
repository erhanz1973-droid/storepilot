import type { LifecycleEvent } from "@/lib/recommendations/intelligence/types";

type Props = {
  events: LifecycleEvent[];
};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function RecommendationTimeline({ events }: Props) {
  if (events.length === 0) {
    return <p className="muted" style={{ fontSize: "0.9rem" }}>No lifecycle events yet.</p>;
  }

  return (
    <ol style={{ margin: 0, paddingLeft: 20 }}>
      {events.map((event) => (
        <li key={event.id} style={{ marginBottom: 12 }}>
          <div style={{ fontSize: "0.8rem", color: "var(--muted)" }}>{formatTime(event.createdAt)}</div>
          <strong style={{ fontSize: "0.95rem" }}>{event.label}</strong>
          {event.detail ? (
            <p className="muted" style={{ margin: "4px 0 0", fontSize: "0.85rem" }}>
              {event.detail}
            </p>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
