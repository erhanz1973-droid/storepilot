import type { ExecutiveSinceLastVisit } from "@/lib/analytics/build-executive-ceo-os";

const DIRECTION_ICON = { up: "↑", down: "↓", neutral: "•", alert: "⚠" } as const;
const DIRECTION_CLASS = {
  up: "exec-briefing-up",
  down: "exec-briefing-down",
  neutral: "exec-briefing-neutral",
  alert: "exec-briefing-alert",
} as const;

export function ExecutiveSinceLastVisitCard({ briefing }: { briefing: ExecutiveSinceLastVisit }) {
  if (briefing.isFirstVisit) return null;

  return (
    <section className="card exec-since-last-visit">
      <h2 style={{ marginTop: 0 }}>Since your last visit</h2>
      {briefing.lastVisitedAt && (
        <p className="muted" style={{ marginTop: 0, fontSize: "0.8rem" }}>
          Last opened {new Date(briefing.lastVisitedAt).toLocaleString()}
        </p>
      )}
      <ul className="exec-briefing-list">
        {briefing.items.map((item) => (
          <li key={item.label} className={DIRECTION_CLASS[item.direction]}>
            <span className="exec-briefing-icon">{DIRECTION_ICON[item.direction]}</span>
            <div>
              <span>{item.label}</span>
              {item.detail && (
                <span className="muted" style={{ display: "block", fontSize: "0.8rem" }}>
                  {item.detail}
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
