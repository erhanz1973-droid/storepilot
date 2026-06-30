import { CustomerDataBadge } from "@/components/customers/CustomerDataBadge";
import type { CustomerIntelligenceAnalytics } from "@/lib/customers/types";

function fmt(n: number): string {
  return n.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

export function CustomerIntelligenceOverview({
  analytics,
}: {
  analytics: CustomerIntelligenceAnalytics;
}) {
  const metrics = [
    { label: "Purchase Frequency", meta: analytics.purchaseFrequency },
    { label: "New vs Returning", meta: analytics.newVsReturning },
    { label: "Repeat Buyers", meta: analytics.repeatBuyers },
    { label: "Churn Risk", meta: analytics.churnRiskCount },
    { label: "VIP Customers", meta: analytics.vipCount },
    { label: "High Potential", meta: analytics.highPotentialCount },
    { label: "Top 10 Revenue Share", meta: analytics.top10RevenueShare },
  ];

  const aggregatedMetrics =
    analytics.dataTier === "aggregated_only"
      ? metrics.filter((m) => m.meta.status !== "unavailable")
      : metrics;

  if (analytics.dataTier === "aggregated_only" && aggregatedMetrics.length === 0) {
    return (
      <div className="card customers-intelligence-overview unavailable">
        <h3 style={{ margin: "0 0 8px" }}>Customer Intelligence</h3>
        <p className="muted" style={{ margin: 0, lineHeight: 1.5 }}>
          Customer-level analytics (profiles, LTV, VIPs and segments) require Shopify Customer sync.
          Aggregated order metrics are shown in the executive summary above.
        </p>
      </div>
    );
  }

  return (
    <div className="card customers-intelligence-overview">
      <h3 style={{ margin: "0 0 12px" }}>Customer Intelligence</h3>
      {analytics.dataTier === "aggregated_only" ? (
        <p className="muted" style={{ margin: "0 0 16px", fontSize: "0.875rem" }}>
          Order-derived metrics below. Customer profiles, LTV, VIPs and segments require Shopify
          Customer sync.
        </p>
      ) : (
        <p className="muted" style={{ margin: "0 0 16px", fontSize: "0.875rem" }}>
          Verified customer metrics from synced Shopify data.
        </p>
      )}
      <div className="customers-intelligence-metrics">
        {(analytics.dataTier === "aggregated_only" ? aggregatedMetrics : metrics).map((m) => (
          <div key={m.label} className="customers-intelligence-metric">
            <span className="muted">{m.label}</span>
            <strong>{m.meta.value}</strong>
            <CustomerDataBadge
              status={m.meta.status}
              notice={m.meta.notice}
              label={m.meta.badgeLabel}
            />
            {m.meta.notice && m.meta.status === "unavailable" && (
              <span className="customers-metric-notice">{m.meta.notice}</span>
            )}
          </div>
        ))}
      </div>
      {analytics.highestLtvCustomers.length > 0 && (
        <div className="customers-intelligence-ltv-preview">
          <h4 style={{ margin: "16px 0 8px" }}>Highest Lifetime Value</h4>
          <ul className="customers-mini-list">
            {analytics.highestLtvCustomers.slice(0, 5).map((c) => (
              <li key={c.id}>
                <strong>{c.name}</strong>
                <span>{c.ltv != null ? fmt(c.ltv) : "—"} LTV · {c.ordersCount} orders</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
