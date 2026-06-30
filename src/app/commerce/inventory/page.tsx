import Link from "next/link";
import { CommerceEmptyState } from "@/components/commerce/CommerceEmptyState";
import { buildCommerceWorkspace } from "@/lib/services/commerce";

export const dynamic = "force-dynamic";

export default async function CommerceInventoryPage() {
  const workspace = await buildCommerceWorkspace();

  if (!workspace) {
    return (
      <>
        <div className="page-header">
          <h2>Inventory</h2>
          <p>Stock levels and velocity from all connected commerce platforms.</p>
        </div>
        <CommerceEmptyState entity="inventory" />
      </>
    );
  }

  const { commerce } = workspace;
  const inventory = [...commerce.inventory].sort((a, b) => {
    const aRisk = a.daysUntilStockout ?? 9999;
    const bRisk = b.daysUntilStockout ?? 9999;
    return aRisk - bRisk;
  });

  return (
    <>
      <div className="page-header">
        <h2>Inventory</h2>
        <p>
          {inventory.length} SKUs from {commerce.platformLabel}. Normalized inventory works the
          same whether your catalog lives on Shopify, Amazon, or WooCommerce.
        </p>
      </div>

      <div className="card">
        <table className="commerce-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>On hand</th>
              <th>Velocity / day</th>
              <th>Days until stockout</th>
            </tr>
          </thead>
          <tbody>
            {inventory.slice(0, 50).map((item) => (
              <tr key={item.productId}>
                <td>{item.title}</td>
                <td>{item.quantity}</td>
                <td>{item.velocityPerDay.toFixed(1)}</td>
                <td>
                  {item.daysUntilStockout != null ? (
                    <span style={{ color: item.daysUntilStockout < 14 ? "var(--high)" : undefined }}>
                      {item.daysUntilStockout}d
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="muted" style={{ marginTop: 12, fontSize: "0.9rem" }}>
        <Link href="/products">View product profitability</Link>
      </p>
    </>
  );
}
