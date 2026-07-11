import type { ProfitWaterfall } from "@/lib/decisions/product-economics";

function formatUsd(amount: number): string {
  return amount.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

type WaterfallStep = {
  label: string;
  amount: number;
  type: "start" | "deduction" | "total";
};

export function ProfitWaterfallChart({ waterfall }: { waterfall: ProfitWaterfall }) {
  const revenue = Math.max(waterfall.revenue, 1);

  const steps: WaterfallStep[] = [
    { label: "Revenue", amount: waterfall.revenue, type: "start" },
    { label: "COGS", amount: -waterfall.productCost, type: "deduction" },
    { label: "Shipping", amount: -waterfall.shipping, type: "deduction" },
    { label: "Payment Fees", amount: -waterfall.processingFees, type: "deduction" },
    { label: "Refunds", amount: -(waterfall.refunds ?? 0), type: "deduction" },
    { label: "Advertising", amount: -waterfall.advertising, type: "deduction" },
    { label: "Net Profit", amount: waterfall.netProfit, type: "total" },
  ];

  const maxVal = Math.max(waterfall.revenue, ...steps.map((s) => Math.abs(s.amount)), 1);

  return (
    <div className="card profit-waterfall-card profit-waterfall-hero">
      <h3 style={{ margin: "0 0 4px" }}>Profit Waterfall</h3>
      <p className="muted" style={{ margin: "0 0 20px", fontSize: "0.9rem" }}>
        Last 30 days — where revenue becomes net profit
      </p>

      <div className="profit-waterfall-chart profit-waterfall-chart-hero">
        {steps.map((step, index) => {
          const heightPct = Math.max(6, (Math.abs(step.amount) / maxVal) * 100);
          const isNegative = step.type === "deduction";
          const isTotal = step.type === "total";
          const pctOfRevenue =
            step.type === "start" || step.type === "total"
              ? Math.round((Math.abs(step.amount) / revenue) * 100)
              : Math.round((Math.abs(step.amount) / revenue) * 100);

          return (
            <div key={step.label} className="profit-waterfall-column">
              {index > 0 && <span className="profit-waterfall-arrow">↓</span>}
              <div
                className={`profit-waterfall-bar ${isTotal ? (step.amount < 0 ? "deduction" : "total") : isNegative ? "deduction" : "start"}`}
                style={{ height: `${heightPct}%` }}
                title={formatUsd(Math.abs(step.amount))}
              />
              <span className="profit-waterfall-label">{step.label}</span>
              <span
                className={`profit-waterfall-value ${isTotal && step.amount < 0 ? "negative" : isTotal ? "positive" : ""}`}
              >
                {isNegative ? "−" : ""}
                {formatUsd(Math.abs(step.amount))}
              </span>
              {step.type === "deduction" && (
                <span className="profit-waterfall-pct muted">{pctOfRevenue}% of revenue</span>
              )}
              {step.type === "total" && (
                <span className="profit-waterfall-pct muted">
                  {step.amount >= 0 ? `${pctOfRevenue}% retained` : "Loss"}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
