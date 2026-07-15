import type { DecisionDetails, ProfitCalculationLine } from "@/lib/approvals/decision-center-types";
import type { DecisionImpactPresentation } from "@/lib/impact/decision-impact";
import { DECISION_IMPACT_COPY } from "@/lib/impact/decision-impact";
import { explainedFromImpactPresentation } from "@/lib/calculations/audit/from-presentation";
import { MetricInfo } from "./MetricInfo";

export function DecisionDetailsSection({
  details,
  impactPresentation,
  supportingFactors,
}: {
  details: DecisionDetails;
  impactPresentation: DecisionImpactPresentation;
  supportingFactors: ProfitCalculationLine[];
}) {
  const recoveryExplained = explainedFromImpactPresentation(impactPresentation, {
    formula: impactPresentation.heroTooltip,
    confidencePct: impactPresentation.confidencePct,
  });

  return (
    <section className="decision-details-section">
      <h5>Decision Details</h5>
      <dl className="decision-details-grid">
        <div>
          <dt>Platform</dt>
          <dd>{details.platform}</dd>
        </div>
        {details.campaignsAffected != null && (
          <div>
            <dt>Campaigns Affected</dt>
            <dd>{details.campaignsAffected}</dd>
          </div>
        )}
        <div>
          <dt>Business Goal</dt>
          <dd>{details.businessGoal}</dd>
        </div>
        <div className="decision-details-recommendation">
          <dt>Recommendation</dt>
          <dd>{details.recommendation}</dd>
        </div>
        <div>
          <dt>
            {impactPresentation.heroLabel}{" "}
            <MetricInfo
              metricKey="recoverable_profit_opportunity"
              title={impactPresentation.heroLabel}
              explained={recoveryExplained}
            />
          </dt>
          <dd className="decision-exec-positive">
            {impactPresentation.heroValueFormatted}/month
          </dd>
        </div>
        {impactPresentation.showNetProfitSecondary ? (
          <div>
            <dt>{impactPresentation.netProfitLabel}</dt>
            <dd className="decision-exec-positive">{impactPresentation.netProfitFormatted}</dd>
          </div>
        ) : null}
        <div>
          <dt>
            {DECISION_IMPACT_COPY.aiConfidence}{" "}
            <MetricInfo metricKey="confidence" />
          </dt>
          <dd>{impactPresentation.confidencePct}%</dd>
        </div>
      </dl>

      {impactPresentation.waterfall.length > 0 && (
        <div className="decision-impact-waterfall">
          <p className="decision-impact-waterfall-title">How this opportunity becomes profit</p>
          <ol className="decision-impact-waterfall-steps">
            {impactPresentation.waterfall.map((step, i) => (
              <li key={step.label}>
                <span className="muted">{step.label}</span>
                <strong>{step.valueFormatted}</strong>
                {i < impactPresentation.waterfall.length - 1 ? (
                  <span className="decision-impact-waterfall-arrow" aria-hidden>
                    ↓
                  </span>
                ) : null}
              </li>
            ))}
          </ol>
          {impactPresentation.waterfallNarrative ? (
            <p className="decision-impact-waterfall-narrative">
              {impactPresentation.waterfallNarrative}
            </p>
          ) : null}
          {supportingFactors.length > 0 && (
            <details className="decision-details-calculation">
              <summary>Supporting factors</summary>
              <ul>
                {supportingFactors.map((line) => (
                  <li key={line.label}>
                    <span className="muted">{line.label}</span>
                    <strong>{line.value}</strong>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </section>
  );
}
