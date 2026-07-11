import type { AcquisitionMetrics } from "@/lib/attribution/models";
import { formatRoas } from "@/lib/attribution/format-roas";

function formatMoney(n: number | null): string {
  if (n == null) return "—";
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export function AcquisitionKpiStrip({ metrics }: { metrics: AcquisitionMetrics }) {
  const kpis = [
    { label: "CAC", value: formatMoney(metrics.cac) },
    { label: "New Customer ROAS", value: formatRoas(metrics.newCustomerRoas) },
    { label: "Returning ROAS", value: formatRoas(metrics.returningCustomerRoas) },
    { label: "Payback Period", value: metrics.paybackPeriodDays != null ? `${metrics.paybackPeriodDays}d` : "—" },
    { label: "LTV:CAC", value: metrics.ltvCacRatio?.toFixed(1) ?? "—" },
    {
      label: "Best Channel",
      value: metrics.bestAcquisitionChannel ?? "—",
    },
  ];

  return (
    <div className="kpi-strip attribution-kpi-strip">
      {kpis.map((k) => (
        <div key={k.label} className="kpi-card">
          <span className="kpi-label">{k.label}</span>
          <strong className="kpi-value">{k.value}</strong>
        </div>
      ))}
    </div>
  );
}
