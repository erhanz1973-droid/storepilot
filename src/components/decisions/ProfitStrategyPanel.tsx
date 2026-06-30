import type { ProfitDecisionEngineResult } from "@/lib/decisions/profit-engine";
import { BUSINESS_MODEL_LABELS } from "@/lib/business-model/types";
import type { BusinessModel } from "@/lib/business-model/types";

function formatUsd(value: number) {
  return value.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

type Plan = ProfitDecisionEngineResult & {
  inventoryStrategiesEnabled?: boolean;
  businessModel?: BusinessModel;
};

export function ProfitStrategyPanel({ plan }: { plan: Plan }) {
  const top = plan.recommendations?.[0];
  const comparison = plan.slowProductStrategies?.[0];
  const inventoryEnabled = plan.inventoryStrategiesEnabled !== false;

  if (!top && !comparison) {
    return (
      <div className="card profit-engine-card" style={{ marginBottom: 24 }}>
        <h3>Profit-aware AI engine</h3>
        <p className="muted" style={{ margin: "8px 0 0" }}>
          {!inventoryEnabled ? (
            <>
              Inventory clearance strategies are disabled for{" "}
              {plan.businessModel
                ? BUSINESS_MODEL_LABELS[plan.businessModel]
                : "your business model"}
              . Switch to Own Inventory in Business Model above to unlock restock and clearance
              comparisons.
            </>
          ) : (
            <>
              No slow-moving products with enough data yet. Connect Shopify and sync to unlock
              strategy comparisons.
            </>
          )}
        </p>
      </div>
    );
  }

  return (
    <div className="stack" style={{ marginBottom: 24 }}>
      <div className="card profit-engine-card">
        <h3>Profit-aware AI engine</h3>
        <p className="muted" style={{ marginTop: 4 }}>
          {plan.objective} Mode: <strong>{plan.merchantMode.replace(/_/g, " ")}</strong>
          {plan.businessModel && (
            <>
              {" "}
              · Business model: <strong>{BUSINESS_MODEL_LABELS[plan.businessModel]}</strong>
            </>
          )}
        </p>
        {top && (
          <div style={{ marginTop: 16 }}>
            <p style={{ margin: "0 0 8px", fontWeight: 600 }}>{top.title}</p>
            <p className="muted" style={{ margin: "0 0 12px", whiteSpace: "pre-line", lineHeight: 1.5 }}>
              {top.reasoning}
            </p>
            <div className="profit-engine-metrics">
              <div><span>Recommended</span><strong>{top.recommendedStrategy}</strong></div>
              <div><span>Net profit (30d)</span><strong>{formatUsd(top.estimatedNetProfit)}</strong></div>
              <div><span>Revenue (30d)</span><strong>{formatUsd(top.estimatedRevenue)}</strong></div>
              <div><span>Inventory impact</span><strong>{Math.round(top.inventoryImpact)} units</strong></div>
              <div><span>Cash flow</span><strong>{formatUsd(top.cashFlowImpact)}</strong></div>
              <div><span>Confidence</span><strong>{Math.round(top.confidenceScore * 100)}%</strong></div>
            </div>
          </div>
        )}
      </div>

      {comparison && (
        <div className="card">
          <h3>Strategy comparison — {comparison.productTitle}</h3>
          <p className="muted" style={{ marginTop: 4, marginBottom: 12 }}>
            {comparison.expectedBusinessImpact}
          </p>
          <div className="table-scroll">
            <table className="commerce-table">
              <thead>
                <tr>
                  <th>Strategy</th>
                  <th>Revenue</th>
                  <th>Net profit</th>
                  <th>Inventory</th>
                  <th>Cash flow</th>
                  <th>Confidence</th>
                </tr>
              </thead>
              <tbody>
                {comparison.strategies.map((strategy) => (
                  <tr
                    key={strategy.strategyId}
                    style={
                      strategy.strategyId === comparison.recommended.strategyId
                        ? { background: "rgba(22, 163, 74, 0.08)" }
                        : undefined
                    }
                  >
                    <td>{strategy.label}</td>
                    <td>{formatUsd(strategy.expectedRevenue)}</td>
                    <td>{formatUsd(strategy.expectedNetProfit)}</td>
                    <td>{Math.round(strategy.inventoryReduction)}</td>
                    <td>{formatUsd(strategy.cashFlowImpact)}</td>
                    <td>{Math.round(strategy.confidence * 100)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
