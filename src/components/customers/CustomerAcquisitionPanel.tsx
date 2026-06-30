import { CustomerDataBadge } from "@/components/customers/CustomerDataBadge";
import type { CustomerAcquisitionRow } from "@/lib/customers/types";

function formatMoney(n: number): string {
  return n.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

export function CustomerAcquisitionPanel({
  acquisition,
}: {
  acquisition: CustomerAcquisitionRow[];
}) {
  if (acquisition.length === 0) {
    return (
      <div className="card customers-empty-state">
        <h3 style={{ marginTop: 0 }}>Customer Acquisition</h3>
        <p className="muted" style={{ margin: 0, lineHeight: 1.5 }}>
          Connect Shopify Customers and your ad platforms to see where customers originate.
        </p>
      </div>
    );
  }

  const maxCustomers = Math.max(...acquisition.map((a) => a.customers), 1);

  return (
    <div className="card customers-acquisition-panel">
      <h3 style={{ margin: "0 0 12px" }}>Customer Acquisition</h3>
      <p className="muted" style={{ margin: "0 0 16px", fontSize: "0.875rem" }}>
        Where your customers come from — verified from synced customer records.
      </p>
      <div className="customers-acquisition-list">
        {acquisition.map((row) => (
          <div key={row.channelId} className="customers-acquisition-row">
            <div className="customers-acquisition-label">
              <strong>{row.label}</strong>
              <span className="muted">
                {row.customersDisplay} customers · {row.sharePct}%
                {row.customersStatus === "estimated" && (
                  <CustomerDataBadge status="estimated" />
                )}
              </span>
            </div>
            <div className="customers-acquisition-bar-wrap">
              <div
                className="customers-acquisition-bar"
                style={{ width: `${(row.customers / maxCustomers) * 100}%` }}
              />
            </div>
            <div className="customers-acquisition-meta">
              <span>
                {row.revenueStatus === "unavailable"
                  ? "Revenue unavailable"
                  : `${formatMoney(row.revenue)} revenue`}
              </span>
              {row.avgLtv != null ? (
                <span>
                  Avg LTV {formatMoney(row.avgLtv)}{" "}
                  <CustomerDataBadge status={row.ltvStatus} />
                </span>
              ) : (
                <span className="muted">LTV not available</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
