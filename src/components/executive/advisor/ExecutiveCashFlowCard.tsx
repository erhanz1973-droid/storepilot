import type { CashFlowBreakdown } from "@/lib/analytics/executive-advisor";
import type { ProfitCalculationTrace } from "@/lib/analytics/executive-finance";
import { ExecutiveCalculationDrawer } from "@/components/executive/advisor/ExecutiveCalculationDrawer";

function fmt(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

type Row = { label: string; value: number; variant?: "cost" | "profit" | "revenue" };

export function ExecutiveCashFlowCard({
  cashFlow,
  profitCalculation,
}: {
  cashFlow: CashFlowBreakdown;
  profitCalculation: ProfitCalculationTrace;
}) {
  if (cashFlow.status === "unavailable") {
    return (
      <section className="exec-advisor-cashflow card">
        <h2 className="exec-advisor-section-title">Cash Flow Breakdown</h2>
        <p className="muted">Complete profit setup to see your cash flow breakdown.</p>
      </section>
    );
  }

  const rows: Row[] = [
    { label: "Revenue", value: cashFlow.revenue, variant: "revenue" },
    { label: "Ad Spend", value: cashFlow.adSpend, variant: "cost" },
    { label: "COGS", value: cashFlow.cogs, variant: "cost" },
    { label: "Shipping", value: cashFlow.shipping, variant: "cost" },
    { label: "Payment Fees", value: cashFlow.paymentFees, variant: "cost" },
    { label: "Returns", value: cashFlow.returns, variant: "cost" },
    { label: "Taxes", value: cashFlow.taxes, variant: "cost" },
  ];

  if (cashFlow.otherCosts > 0) {
    rows.push({ label: "Other Costs", value: cashFlow.otherCosts, variant: "cost" });
  }

  rows.push({
    label: "Estimated Profit",
    value: cashFlow.estimatedProfit,
    variant: "profit",
  });

  const maxVal = Math.max(cashFlow.revenue, 1);

  return (
    <section className="exec-advisor-cashflow card">
      <h2 className="exec-advisor-section-title">Cash Flow Breakdown</h2>
      {cashFlow.status === "estimated" && (
        <p className="exec-advisor-estimated-badge muted">Estimated from available data</p>
      )}
      <div className="exec-advisor-cashflow-rows">
        {rows.map((row) => (
          <div key={row.label} className={`exec-advisor-cashflow-row ${row.variant ?? ""}`}>
            <div className="exec-advisor-cashflow-label">
              <span>{row.label}</span>
              <strong className={row.variant === "profit" && row.value < 0 ? "negative" : ""}>
                {row.variant === "cost" ? "−" : ""}
                {fmt(Math.abs(row.value))}
              </strong>
            </div>
            {row.variant !== "profit" && (
              <div className="exec-advisor-cashflow-bar-track">
                <div
                  className="exec-advisor-cashflow-bar-fill"
                  style={{ width: `${Math.min(100, (Math.abs(row.value) / maxVal) * 100)}%` }}
                />
              </div>
            )}
          </div>
        ))}
      </div>
      <ExecutiveCalculationDrawer
        trace={profitCalculation}
        displayValue={cashFlow.estimatedProfit}
        compact
      />
    </section>
  );
}
