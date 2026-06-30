import type { ProfitPeriodMetrics, ProfitStatus } from "@/lib/profit/types";

function formatMoney(n: number): string {
  return n.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function periodStatus(period: ProfitPeriodMetrics): ProfitStatus {
  return period.netProfitMeta.status;
}

export function ProfitPeriodCard({ period }: { period: ProfitPeriodMetrics }) {
  const status = periodStatus(period);
  const unavailable = status === "unavailable";
  const estimated = status === "estimated";
  const positive = (period.netProfit ?? 0) >= 0;

  return (
    <div
      className={`profit-period-card ${estimated ? "estimated" : ""} ${unavailable ? "unavailable" : ""}`}
    >
      <span className="muted profit-period-label">{period.label}</span>
      <strong
        className={`profit-period-net ${unavailable ? "muted" : positive ? "positive" : "negative"}`}
      >
        {unavailable ? "Not Available" : formatMoney(period.netProfit ?? 0)}
      </strong>
      <span className="muted" style={{ fontSize: "0.8rem" }}>
        {formatMoney(period.revenue)} revenue
        {period.profitMarginPct != null ? ` · ${period.profitMarginPct}% margin` : ""}
        {estimated ? " · estimated" : status === "verified" ? " · verified" : ""}
      </span>
    </div>
  );
}

export function ProfitKpiGrid({ period }: { period: ProfitPeriodMetrics }) {
  const status = periodStatus(period);
  const estimated = status === "estimated";
  const unavailable = status === "unavailable";
  const cogsLabel = estimated ? "COGS (estimated)" : "COGS";
  const netLabel =
    unavailable ? "Net Profit" : estimated ? "Est. Net Profit" : "Net Profit";

  const items = [
    { label: "Revenue", value: formatMoney(period.revenue) },
    { label: "Gross Profit", value: formatMoney(period.grossProfit) },
    {
      label: netLabel,
      value: unavailable ? "Not Available" : formatMoney(period.netProfit ?? 0),
    },
    {
      label: "Margin",
      value: period.profitMarginPct != null ? `${period.profitMarginPct}%` : "—",
    },
    { label: cogsLabel, value: formatMoney(period.cogs) },
    { label: "Ad Spend", value: formatMoney(period.adSpend) },
    { label: "Shipping", value: formatMoney(period.shippingCost) },
    { label: "Fees", value: formatMoney(period.transactionFees) },
    { label: "Refunds", value: formatMoney(period.refunds) },
  ];

  return (
    <div className="profit-kpi-grid">
      {items.map((item) => (
        <div key={item.label} className="profit-kpi-item">
          <span className="muted profit-kpi-label">{item.label}</span>
          <strong>{item.value}</strong>
        </div>
      ))}
    </div>
  );
}
