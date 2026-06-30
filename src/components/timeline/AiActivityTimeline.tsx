import type { ActivityFeedEntry } from "@/lib/timeline/activity-feed";

const SEVERITY_CLASS: Record<NonNullable<ActivityFeedEntry["severity"]>, string> = {
  info: "timeline-info",
  warning: "timeline-pending",
  critical: "timeline-rejected",
  success: "timeline-measured",
};

export function AiActivityTimeline({ entries }: { entries: ActivityFeedEntry[] }) {
  return (
    <div className="card">
      <h3>AI Timeline</h3>
      <p className="muted" style={{ marginTop: 4, marginBottom: 12, fontSize: "0.875rem" }}>
        Your daily activity log — what StorePilot detected and analyzed
      </p>
      <ol className="decision-timeline activity-feed">
        {entries.map((e) => (
          <li key={e.id} className={SEVERITY_CLASS[e.severity ?? "info"]}>
            <div className="timeline-date">
              <strong>{e.relativeLabel}</strong>
            </div>
            <p style={{ margin: "4px 0" }}>{e.event}</p>
            {e.detail && (
              <p className="muted" style={{ margin: 0, fontSize: "0.875rem" }}>
                {e.detail}
              </p>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
