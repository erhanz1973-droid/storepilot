import type { WinProblemItem } from "@/lib/reports/types";

const URGENCY_LABEL: Record<NonNullable<WinProblemItem["urgency"]>, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

function Card({
  title,
  icon,
  items,
  variant,
}: {
  title: string;
  icon: string;
  items: WinProblemItem[];
  variant: "wins" | "problems";
}) {
  return (
    <section className={`card reports-wins-problems reports-${variant}`}>
      <div className="reports-section-head">
        <span className="reports-section-icon" aria-hidden>
          {icon}
        </span>
        <h3>{title}</h3>
      </div>
      <ul className="reports-wp-list">
        {items.map((item) => (
          <li
            key={`${item.label}-${item.value}`}
            className={[
              item.tone ? `tone-${item.tone}` : "",
              item.isAchievement ? "is-achievement" : "",
              item.urgency ? `urgency-${item.urgency}` : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {variant === "wins" && item.isAchievement && (
              <span className="reports-wp-check" aria-hidden>
                ✅
              </span>
            )}
            {variant === "problems" && item.urgency && (
              <span className={`reports-wp-urgency urgency-${item.urgency}`}>
                {URGENCY_LABEL[item.urgency]}
              </span>
            )}
            <div className="reports-wp-content">
              <span className="reports-wp-label">{item.label}</span>
              <span className="reports-wp-value">{item.value}</span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function WinsProblemsSection({
  wins,
  problems,
}: {
  wins: WinProblemItem[];
  problems: WinProblemItem[];
}) {
  return (
    <div className="reports-wins-problems-grid">
      <Card title="Biggest Wins" icon="✓" items={wins} variant="wins" />
      <Card title="Biggest Problems" icon="!" items={problems} variant="problems" />
    </div>
  );
}
