import { CommerceEmptyState } from "@/components/commerce/CommerceEmptyState";
import { buildCommerceWorkspace } from "@/lib/services/commerce";

export const dynamic = "force-dynamic";

function formatCurrency(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 2 });
}

export default async function CommerceOrdersPage() {
  const workspace = await buildCommerceWorkspace();

  if (!workspace) {
    return (
      <>
        <div className="page-header">
          <h2>Orders</h2>
          <p>Normalized order data from all connected commerce platforms.</p>
        </div>
        <CommerceEmptyState entity="orders" />
      </>
    );
  }

  const { commerce } = workspace;
  const orders = [...commerce.orders].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return (
    <>
      <div className="page-header">
        <h2>Orders</h2>
        <p>
          {commerce.metrics.orders30d} orders in the last 30 days from {commerce.platformLabel}.
          Provider-agnostic view — same model for Shopify, Amazon, WooCommerce, and more.
        </p>
      </div>

      {orders.length === 0 ? (
        <div className="card">
          <p className="muted" style={{ margin: 0 }}>
            No order detail rows synced yet. Order metrics are available at the store level.
          </p>
        </div>
      ) : (
        <div className="card">
          <table className="commerce-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Date</th>
                <th>Revenue</th>
                <th>Customer</th>
                <th>Platform</th>
              </tr>
            </thead>
            <tbody>
              {orders.slice(0, 50).map((order) => (
                <tr key={order.id}>
                  <td>{order.externalId}</td>
                  <td>{new Date(order.createdAt).toLocaleDateString()}</td>
                  <td>{formatCurrency(order.revenue)}</td>
                  <td>{order.isNewCustomer ? "New" : "Returning"}</td>
                  <td className="muted">{commerce.platformLabel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
