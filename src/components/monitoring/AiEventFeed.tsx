import type { AIEvent } from "@/lib/monitoring/types";
import { MetricPills } from "@/components/MetricPills";

const SEVERITY_BADGE: Record<AIEvent["severity"], string> = {
  info: "badge-medium",
  warning: "badge-high",
  critical: "badge-critical",
};

export function AiEventFeed({ events }: { events: AIEvent[] }) {
  if (events.length === 0) return null;

  return (
    <div className="card">
      <h3>Proactive AI Feed</h3>
      <p className="muted" style={{ marginTop: 4, marginBottom: 16, fontSize: "0.875rem" }}>
        StorePilot continuously monitors your business — no questions required
      </p>
      <div className="stack">
        {events.slice(0, 8).map((event) => (
          <article
            key={event.id}
            style={{ padding: "14px 0", borderBottom: "1px solid var(--border)" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
                  <span className={`badge ${SEVERITY_BADGE[event.severity]}`}>{event.severity}</span>
                  <span className="badge badge-medium" style={{ opacity: 0.8 }}>
                    {event.monitor}
                  </span>
                </div>
                <h4 style={{ margin: "0 0 4px", fontSize: "0.95rem" }}>{event.title}</h4>
                <p className="muted" style={{ margin: "0 0 8px", fontSize: "0.875rem" }}>
                  {event.description}
                </p>
                {event.evidence.length > 0 && <MetricPills metrics={event.evidence} />}
                <p style={{ margin: "8px 0 0", fontSize: "0.875rem" }}>
                  <strong>Recommendation:</strong> {event.recommendation}
                </p>
                {event.estimatedImpact?.label && (
                  <p className="muted" style={{ margin: "4px 0 0", fontSize: "0.8rem" }}>
                    Est. impact: {event.estimatedImpact.label}
                  </p>
                )}
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontWeight: 700 }}>{event.confidencePct}%</div>
                <div className="muted" style={{ fontSize: "0.75rem" }}>
                  confidence
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
