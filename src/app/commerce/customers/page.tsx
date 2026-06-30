import { CommerceEmptyState } from "@/components/commerce/CommerceEmptyState";
import { buildCommerceWorkspace } from "@/lib/services/commerce";

export const dynamic = "force-dynamic";

function formatCurrency(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export default async function CommerceCustomersPage() {
  const workspace = await buildCommerceWorkspace();

  if (!workspace) {
    return (
      <>
        <div className="page-header">
          <h2>Customers</h2>
          <p>Normalized customer data from all connected commerce platforms.</p>
        </div>
        <CommerceEmptyState entity="customers" />
      </>
    );
  }

  const { commerce } = workspace;
  const customers = [...commerce.customers].sort((a, b) => b.totalSpent - a.totalSpent);

  return (
    <>
      <div className="page-header">
        <h2>Customers</h2>
        <p>
          {customers.length > 0
            ? `${customers.length} customers synced from ${commerce.platformLabel}.`
            : `Customer profiles will appear here once synced from ${commerce.platformLabel}.`}
        </p>
      </div>

      {customers.length === 0 ? (
        <div className="card">
          <p className="muted" style={{ margin: 0 }}>
            Customer records are not included in the current sync snapshot. Connect and sync your
            store to populate this view.
          </p>
        </div>
      ) : (
        <div className="card">
          <table className="commerce-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Orders</th>
                <th>Total spent</th>
                <th>Type</th>
                <th>Platform</th>
              </tr>
            </thead>
            <tbody>
              {customers.slice(0, 50).map((customer) => (
                <tr key={customer.id}>
                  <td>{customer.email ?? customer.externalId}</td>
                  <td>{customer.ordersCount}</td>
                  <td>{formatCurrency(customer.totalSpent)}</td>
                  <td>{customer.isReturning ? "Returning" : "New"}</td>
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
