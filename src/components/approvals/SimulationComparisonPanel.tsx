import type { SimulationComparison } from "@/lib/approvals/decision-center-types";
import { MetricInfo } from "./MetricInfo";

function fmt(n: number): string {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export function SimulationComparisonPanel({ comparison }: { comparison: SimulationComparison }) {
  return (
    <section className="decision-simulation-comparison">
      <h5>Simulation Comparison</h5>
      <div className="decision-simulation-columns">
        <div className="decision-simulation-scenario">
          <span className="decision-simulation-label">Without Approval</span>
          <dl>
            <div>
              <dt>Profit</dt>
              <dd>{fmt(comparison.withoutApproval.profit)}</dd>
            </div>
            <div>
              <dt>
                ROAS <MetricInfo metricKey="roas" />
              </dt>
              <dd>{comparison.withoutApproval.roas}</dd>
            </div>
            <div>
              <dt>Ad Spend</dt>
              <dd>{fmt(comparison.withoutApproval.adSpend)}</dd>
            </div>
          </dl>
        </div>
        <div className="decision-simulation-scenario is-approved">
          <span className="decision-simulation-label">With Approval</span>
          <dl>
            <div>
              <dt>Profit</dt>
              <dd className="decision-exec-positive">{fmt(comparison.withApproval.profit)}</dd>
            </div>
            <div>
              <dt>
                ROAS <MetricInfo metricKey="roas" />
              </dt>
              <dd>{comparison.withApproval.roas}</dd>
            </div>
            <div>
              <dt>Ad Spend</dt>
              <dd>{fmt(comparison.withApproval.adSpend)}</dd>
            </div>
          </dl>
        </div>
      </div>
      <div className="decision-simulation-diff">
        <strong>Difference</strong>
        <span className="decision-exec-positive">+{fmt(comparison.difference.profit)} Profit</span>
        <span>{fmt(comparison.difference.adSpend)} Spend</span>
        {comparison.difference.roasPctImprovement > 0 && (
          <span>+{comparison.difference.roasPctImprovement}% ROAS</span>
        )}
      </div>
    </section>
  );
}
