import type { ExecutiveHealthBreakdown } from "@/lib/analytics/executive-advisor";

function scoreColor(score: number): string {
  if (score >= 70) return "var(--low)";
  if (score >= 40) return "var(--medium)";
  return "var(--critical)";
}

export function ExecutiveHealthBreakdownCard({
  health,
}: {
  health: ExecutiveHealthBreakdown | null;
}) {
  if (!health) return null;

  const overallColor = scoreColor(health.overall);

  return (
    <section className="exec-advisor-health card">
      <h2 className="exec-advisor-section-title">Store Health</h2>
      <div className="exec-advisor-health-header">
        <div className="health-ring" style={{ borderColor: overallColor }}>
          <span className="health-ring-value">{health.overall}</span>
          <span className="health-ring-max">/100</span>
        </div>
        <div>
          <p style={{ margin: 0, fontWeight: 600, color: overallColor }}>{health.label}</p>
          <p className="muted" style={{ margin: "4px 0 0", fontSize: "0.875rem" }}>
            Breakdown by category
          </p>
        </div>
      </div>
      <ul className="exec-advisor-health-categories">
        {health.categories.map((cat) => (
          <li key={cat.id} className="exec-advisor-health-category">
            <div className="exec-advisor-health-category-head">
              <span>{cat.label}</span>
              <strong style={{ color: scoreColor(cat.score) }}>
                {cat.score}/100
              </strong>
            </div>
            <p className="muted exec-advisor-health-explanation">{cat.explanation}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
