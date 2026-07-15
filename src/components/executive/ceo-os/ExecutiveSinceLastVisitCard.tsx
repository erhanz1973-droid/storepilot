import type { ExecutiveSinceLastVisit } from "@/lib/analytics/build-executive-ceo-os";

const DIRECTION_ICON = { up: "↑", down: "↓", neutral: "•", alert: "!" } as const;
const DIRECTION_CHIP = {
  up: "exec-ceo-chip-ok",
  down: "exec-ceo-chip-warn",
  neutral: "exec-ceo-chip-muted",
  alert: "exec-ceo-chip-warn",
} as const;

export function ExecutiveSinceLastVisitCard({ briefing }: { briefing: ExecutiveSinceLastVisit }) {
  return (
    <section className="card exec-ceo-secondary-card exec-since-last-visit">
      <div className="exec-ceo-secondary-head">
        <h3>Since last visit</h3>
        {briefing.lastVisitedAt ? (
          <span className="muted exec-ceo-secondary-meta">
            {new Date(briefing.lastVisitedAt).toLocaleDateString()}
          </span>
        ) : (
          <span className="exec-ceo-chip exec-ceo-chip-muted">New</span>
        )}
      </div>
      {briefing.isFirstVisit || briefing.items.length === 0 ? (
        <p className="muted exec-ceo-card-fill">First visit — baselines will appear after your next session.</p>
      ) : (
        <ul className="exec-ceo-compact-list">
          {briefing.items.slice(0, 4).map((item) => (
            <li key={item.label} className="exec-ceo-compact-row">
              <span className={`exec-ceo-chip ${DIRECTION_CHIP[item.direction]}`}>
                {DIRECTION_ICON[item.direction]} {item.label}
              </span>
              {item.detail ? (
                <span className="muted exec-ceo-compact-detail">{item.detail}</span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
