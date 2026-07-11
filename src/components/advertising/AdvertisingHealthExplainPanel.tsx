import type { AdvertisingExecutiveOverview, HealthExplanationItem } from "@/lib/advertising/types";
import { HEALTH_TIER_LABELS } from "@/lib/advertising/types";

const SEVERITY_CLASS = {
  high: "adv-problem-high",
  medium: "adv-problem-medium",
  low: "adv-problem-low",
} as const;

export function AdvertisingHealthExplainPanel({
  overview,
  explanations,
}: {
  overview: AdvertisingExecutiveOverview;
  explanations: HealthExplanationItem[];
}) {
  const isLow = overview.healthScore < 60;

  return (
    <div className="card adv-health-explain">
      <div className="adv-health-explain-header">
        <div>
          <span className="muted" style={{ fontSize: "0.8rem" }}>Advertising Health</span>
          <div className="adv-health-score-row">
            <strong className="adv-health-score">{overview.healthScore}</strong>
            <span className="muted">/ 100</span>
          </div>
          <span className={`adv-health-tier adv-tier-${overview.healthTier}`}>
            {HEALTH_TIER_LABELS[overview.healthTier]}
          </span>
        </div>
        {overview.healthFactors && overview.healthFactors.length > 0 && (
          <dl className="adv-health-factors adv-health-factors-compact">
            {overview.healthFactors.map((f) => (
              <div key={f.id} className="adv-health-factor-row">
                <dt>{f.label}</dt>
                <dd>
                  <span className={`adv-health-pill adv-tier-${f.tier}`}>{f.score}</span>
                </dd>
              </div>
            ))}
          </dl>
        )}
      </div>

      {isLow && explanations.length > 0 && (
        <div className="adv-health-why">
          <strong className="adv-health-why-title">Why is the score low?</strong>
          <ul className="adv-health-why-list">
            {explanations.map((e) => (
              <li key={e.label} className={SEVERITY_CLASS[e.severity]}>
                ✓ {e.label}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
