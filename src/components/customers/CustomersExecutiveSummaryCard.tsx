import { CustomerDataBadge } from "@/components/customers/CustomerDataBadge";
import type { CustomerDataTier, CustomersExecutiveSummary } from "@/lib/customers/types";

type MetricKey = keyof CustomersExecutiveSummary;

const METRIC_LABELS: Record<MetricKey, string> = {
  totalCustomers: "Total Customers",
  newCustomers: "New Customers",
  returningCustomers: "Returning Customers",
  repeatPurchaseRate: "Repeat Purchase Rate",
  averageOrderValue: "Average Order Value",
  estimatedLtv: "Estimated Lifetime Value",
  customerHealthScore: "Customer Health Score",
};

export function CustomersExecutiveSummaryCard({
  summary,
  dataTier,
}: {
  summary: CustomersExecutiveSummary;
  dataTier: CustomerDataTier;
}) {
  const entries = Object.entries(METRIC_LABELS) as [MetricKey, string][];

  return (
    <div className="card customers-executive-summary">
      <h3 style={{ margin: "0 0 12px" }}>Customer Executive Summary</h3>
      {dataTier === "aggregated_only" && (
        <p className="customers-sync-notice muted" style={{ margin: "0 0 12px", fontSize: "0.875rem" }}>
          Customer-level analytics (profiles, LTV, VIPs and segments) require Shopify Customer sync.
        </p>
      )}
      <div className="customers-summary-grid">
        {entries.map(([key, label]) => {
          const meta = summary[key];
          return (
            <div key={key} className="customers-summary-metric">
              <span className="muted">{label}</span>
              <strong>{meta.value}</strong>
              <CustomerDataBadge status={meta.status} notice={meta.notice} label={meta.badgeLabel} />
              {meta.notice && (meta.status === "unavailable" || meta.status === "estimated") && (
                <span className="customers-metric-notice">{meta.notice}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
