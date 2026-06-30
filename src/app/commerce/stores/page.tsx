import Link from "next/link";
import { CommerceEmptyState } from "@/components/commerce/CommerceEmptyState";
import { buildCommerceWorkspace } from "@/lib/services/commerce";

export const dynamic = "force-dynamic";

function formatCurrency(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export default async function CommerceStoresPage() {
  const workspace = await buildCommerceWorkspace();

  if (!workspace) {
    return (
      <>
        <div className="page-header">
          <h2>Stores</h2>
          <p>Connected commerce platforms across your organization.</p>
        </div>
        <CommerceEmptyState entity="stores" />
      </>
    );
  }

  const connected = workspace.stores.filter((s) => s.connected);

  return (
    <>
      <div className="page-header">
        <h2>Stores</h2>
        <p>
          {connected.length} connected platform{connected.length === 1 ? "" : "s"}. Data is
          normalized from any commerce provider. Last synced{" "}
          {new Date(workspace.syncedAt).toLocaleString()}.
        </p>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <table className="commerce-table">
          <thead>
            <tr>
              <th>Platform</th>
              <th>Status</th>
              <th>Store</th>
              <th>Products</th>
              <th>Orders (30d)</th>
              <th>Revenue (30d)</th>
            </tr>
          </thead>
          <tbody>
            {workspace.stores.map((row) => (
              <tr key={row.platform.id}>
                <td>
                  <strong>{row.platform.label}</strong>
                </td>
                <td>
                  {row.connected ? (
                    <span style={{ color: "var(--low)" }}>Connected</span>
                  ) : row.platform.status === "planned" ? (
                    <span className="muted">Coming soon</span>
                  ) : (
                    <span className="muted">Not connected</span>
                  )}
                </td>
                <td>{row.storeDomain ?? "—"}</td>
                <td>{row.connected ? row.products : "—"}</td>
                <td>{row.connected ? row.orders30d : "—"}</td>
                <td>{row.connected ? formatCurrency(row.revenue30d) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="muted" style={{ fontSize: "0.9rem" }}>
        <Link href="/connections?tab=commerce">Manage commerce connections</Link>
      </p>
    </>
  );
}
