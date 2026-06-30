import type { RevenueImpactEstimate } from "@/lib/impact/estimate";
import { formatCurrency } from "@/lib/impact/estimate";

export function RevenueImpactPanel({ impact }: { impact: RevenueImpactEstimate }) {
  return (
    <div className="revenue-impact-panel" style={{ marginTop: 12 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: 12,
        }}
      >
        <div>
          <p className="muted" style={{ margin: "0 0 4px", fontSize: "0.75rem" }}>
            Est. Monthly Revenue Impact
          </p>
          <p style={{ margin: 0, fontSize: "1.15rem", fontWeight: 700 }}>
            {formatCurrency(impact.monthlyRevenue)}
          </p>
        </div>
        <div>
          <p className="muted" style={{ margin: "0 0 4px", fontSize: "0.75rem" }}>
            Est. Profit
          </p>
          <p style={{ margin: 0, fontSize: "1.15rem", fontWeight: 700 }}>
            {formatCurrency(impact.monthlyProfit)}
          </p>
        </div>
        <div>
          <p className="muted" style={{ margin: "0 0 4px", fontSize: "0.75rem" }}>
            Confidence
          </p>
          <p style={{ margin: 0, fontSize: "1.15rem", fontWeight: 700 }}>
            {impact.confidencePct}%
          </p>
        </div>
      </div>
    </div>
  );
}
