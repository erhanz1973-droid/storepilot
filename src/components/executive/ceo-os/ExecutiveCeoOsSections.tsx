import type {
  ExecutiveAccountabilityItem,
  ExecutivePlannedDecision,
  ExecutiveRiskStory,
} from "@/lib/analytics/build-executive-ceo-os";

const TYPE_LABEL = {
  rejected: "Not approved — cost of waiting",
  approved: "Approved — results tracked",
  pending: "Awaiting your decision",
  measuring: "Measuring outcome",
} as const;

export function ExecutiveAccountabilityCard({ items }: { items: ExecutiveAccountabilityItem[] }) {
  if (items.length === 0) return null;

  return (
    <section className="card exec-accountability">
      <h2 style={{ marginTop: 0 }}>I remember my previous advice</h2>
      <p className="muted" style={{ marginTop: 0, fontSize: "0.875rem" }}>
        What I recommended, what you decided, and what happened next.
      </p>
      <div className="exec-accountability-list">
        {items.map((item) => (
          <article key={item.id} className={`exec-accountability-item exec-acc-${item.type}`}>
            <span className="exec-accountability-type">{TYPE_LABEL[item.type]}</span>
            <strong>{item.title}</strong>
            <p className="exec-accountability-narrative">{item.narrative}</p>
            {item.metrics.length > 0 && (
              <dl className="exec-accountability-metrics">
                {item.metrics.map((m) => (
                  <div key={m.label}>
                    <dt>{m.label}</dt>
                    <dd>{m.value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

export function ExecutiveRiskStoryCard({ story }: { story: ExecutiveRiskStory }) {
  return (
    <section className="card exec-risk-story">
      <h2 style={{ marginTop: 0 }}>{story.headline}</h2>
      <p className="exec-risk-story-body">{story.story}</p>
    </section>
  );
}

export function ExecutivePlannedDecisionsCard({ items }: { items: ExecutivePlannedDecision[] }) {
  if (items.length === 0) return null;

  return (
    <section className="card exec-planned-decisions">
      <h2 style={{ marginTop: 0 }}>Planned for later — not today</h2>
      <p className="muted" style={{ marginTop: 0, fontSize: "0.875rem" }}>
        These stay on my radar. You do not need to decide them today.
      </p>
      <ol className="exec-planned-list">
        {items.map((item) => (
          <li key={item.rank}>
            <div className="exec-planned-header">
              <strong>{item.title}</strong>
              <span className="exec-planned-when">{item.plannedLabel}</span>
            </div>
            <span className="muted" style={{ fontSize: "0.85rem" }}>{item.impactLabel}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function ExecutiveWatchStrip({ message }: { message: string }) {
  return (
    <div className="exec-watch-strip card" role="status">
      <span className="exec-watch-pulse" aria-hidden />
      <p style={{ margin: 0 }}>{message}</p>
    </div>
  );
}
