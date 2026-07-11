import type { DecisionDetails, ProfitCalculationLine } from "@/lib/approvals/decision-center-types";
import { MetricInfo } from "./MetricInfo";

export function DecisionDetailsSection({
  details,
  profitCalculation,
}: {
  details: DecisionDetails;
  profitCalculation: ProfitCalculationLine[];
}) {
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
            Expected Impact <MetricInfo metricKey="estimated_profit" />
          </dt>
          <dd className="decision-exec-positive">
            +${details.expectedImpactMonthly.toLocaleString()}/month
          </dd>
        </div>
      </dl>

      {profitCalculation.length > 0 && (
        <details className="decision-details-calculation">
          <summary>Calculated from</summary>
          <ul>
            {profitCalculation.map((line) => (
              <li key={line.label}>
                <span className="muted">{line.label}</span>
                <strong>{line.value}</strong>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
