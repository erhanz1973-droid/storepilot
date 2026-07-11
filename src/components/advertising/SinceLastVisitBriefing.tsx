import type { SinceLastVisitBriefing } from "@/lib/advertising/types";

const DIRECTION_ICON = {
  up: "↑",
  down: "↓",
  neutral: "•",
  alert: "⚠",
} as const;

const DIRECTION_CLASS = {
  up: "adv-briefing-up",
  down: "adv-briefing-down",
  neutral: "adv-briefing-neutral",
  alert: "adv-briefing-alert",
} as const;

export function SinceLastVisitBriefing({ briefing }: { briefing: SinceLastVisitBriefing }) {
  if (briefing.isFirstVisit) return null;

  return (
    <div className="card adv-since-last-visit">
      <h2 style={{ marginTop: 0 }}>Since your last visit</h2>
      {briefing.lastVisitedAt && (
        <p className="muted" style={{ marginTop: 0, fontSize: "0.8rem" }}>
          Last opened {new Date(briefing.lastVisitedAt).toLocaleString()}
        </p>
      )}
      <ul className="adv-briefing-list">
        {briefing.items.map((item) => (
          <li key={item.label} className={DIRECTION_CLASS[item.direction]}>
            <span className="adv-briefing-icon">{DIRECTION_ICON[item.direction]}</span>
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
    </div>
  );
}
