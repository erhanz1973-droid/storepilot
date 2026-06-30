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
    <div className="card profit-waterfall-card">
      <h3 style={{ margin: "0 0 4px" }}>Profit Waterfall</h3>
      <p className="muted" style={{ margin: "0 0 16px", fontSize: "0.875rem" }}>
        Last 30 days — how revenue becomes net profit
      </p>

      <div className="profit-waterfall-chart">
        {steps.map((step, index) => {
          const heightPct = Math.max(4, (Math.abs(step.amount) / maxVal) * 100);
          const isNegative = step.type === "deduction";
          const isTotal = step.type === "total";
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
            </div>
          );
        })}
      </div>
    </div>
  );
}
