import type { CustomerRecord } from "@/lib/customers/types";

function formatMoney(n: number | null): string {
  if (n == null) return "—";
  return n.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function statusClass(status: CustomerRecord["status"]): string {
  switch (status) {
    case "VIP":
      return "customer-status-vip";
    case "Growing":
      return "customer-status-growing";
    case "At Risk":
      return "customer-status-risk";
    case "Inactive":
      return "customer-status-inactive";
    case "New":
      return "customer-status-new";
    default:
      return "";
  }
}

export function CustomerTopTable({
  customers,
  onSelect,
}: {
  customers: CustomerRecord[];
  onSelect: (customer: CustomerRecord) => void;
}) {
  if (customers.length === 0) {
    return (
      <div className="card customers-empty-state">
        <h3 style={{ marginTop: 0 }}>Top Customers</h3>
        <p style={{ margin: "0 0 8px", lineHeight: 1.5 }}>
          Customer records require Shopify customer sync.
        </p>
        <p className="muted" style={{ margin: 0, lineHeight: 1.5, fontSize: "0.875rem" }}>
          Connect Shopify Customers and Orders to see ranked customers with lifetime spend, order
          history, and VIP status.
        </p>
      </div>
    );
  }

  return (
    <div className="card customers-top-table">
      <h3 style={{ margin: "0 0 12px" }}>Top Customers</h3>
      <div className="customers-table-wrap">
        <table className="customers-table">
          <thead>
            <tr>
              <th>Customer</th>
              <th>Orders</th>
              <th>Revenue</th>
              <th>Lifetime Value</th>
              <th>AOV</th>
              <th>Last Purchase</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => (
              <tr key={c.id} onClick={() => onSelect(c)} className="customers-table-row">
                <td>
                  <strong>{c.name}</strong>
                  <span className="muted customers-table-email">{c.email}</span>
                </td>
                <td>{c.ordersCount}</td>
                <td>{formatMoney(c.lifetimeRevenue)}</td>
                <td>
                  {c.ltv != null ? formatMoney(c.ltv) : "—"}
                  {c.ltvStatus !== "verified" && c.ltv != null && (
                    <span className="muted" style={{ fontSize: "0.7rem", display: "block" }}>
                      {c.ltvStatus}
                    </span>
                  )}
                </td>
                <td>{formatMoney(c.aov)}</td>
                <td>{c.lastPurchaseAt}</td>
                <td>
                  <span className={`customer-status-pill ${statusClass(c.status)}`}>
                    {c.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
