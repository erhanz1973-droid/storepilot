import type { ScorecardItem } from "@/lib/reports/types";

function arrow(item: ScorecardItem): string {
  if (item.direction === "up") return "▲";
  if (item.direction === "down") return "▼";
  return "—";
}

function changeLabel(item: ScorecardItem): string {
  if (item.changePct != null) {
    const sign = item.changePct > 0 ? "+" : "";
    return `${sign}${item.changePct}%`;
  }
  return item.unavailableReason ?? "Data pending";
}

export function WeeklyScorecard({ items }: { items: ScorecardItem[] }) {
  return (
    <section className="card reports-scorecard">
      <div className="reports-section-head">
        <span className="reports-section-icon" aria-hidden>
          📊
        </span>
        <h3>Weekly Scorecard</h3>
      </div>
      <div className="reports-scorecard-grid">
        {items.map((item) => (
          <div
            key={item.id}
            className={`reports-scorecard-item ${item.direction === "up" ? "up" : item.direction === "down" ? "down" : ""} ${item.changePct == null ? "is-pending" : ""}`}
          >
            <span className="reports-scorecard-label">{item.label}</span>
            <span className="reports-scorecard-trend">
              {item.changePct != null ? (
                <>
                  {arrow(item)} {changeLabel(item)}
                </>
              ) : (
                <span className="reports-scorecard-pending">{changeLabel(item)}</span>
              )}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
