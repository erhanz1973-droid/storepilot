"use client";

import { CustomerDataBadge } from "@/components/customers/CustomerDataBadge";
import type { CustomerRecord } from "@/lib/customers/types";

function formatMoney(n: number | null): string {
  if (n == null) return "—";
  return n.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function recommendationFor(customer: CustomerRecord): string {
  switch (customer.segment) {
    case "vip":
      return "Reward with early access or exclusive offers to maintain loyalty.";
    case "at_risk":
      return "Send a personalized win-back offer — last purchase was over 55 days ago.";
    case "inactive":
      return "Re-engage with a targeted email campaign or limited-time discount.";
    case "one_time":
      return "Trigger a post-purchase follow-up to encourage a second order.";
    case "new":
      return "Welcome series and first-repeat incentive within 14 days.";
    default:
      return "Continue nurturing with relevant product recommendations.";
  }
}

type Props = {
  customer: CustomerRecord | null;
  open: boolean;
  onClose: () => void;
};

export function CustomerDetailDrawer({ customer, open, onClose }: Props) {
  if (!open || !customer) return null;

  const c = customer;

  return (
    <div className="product-attribution-drawer-backdrop" onClick={onClose} role="presentation">
      <aside
        className="product-attribution-drawer customers-detail-drawer"
        onClick={(e) => e.stopPropagation()}
        aria-label={`${c.name} profile`}
      >
        <div className="product-attribution-drawer-header">
          <div>
            <h3 style={{ margin: 0 }}>{c.name}</h3>
            <p className="muted" style={{ margin: "4px 0 0", fontSize: "0.85rem" }}>
              {c.email} · {c.status}
            </p>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            Close
          </button>
        </div>

        <section className="product-attribution-drawer-section">
          <h4>Overview</h4>
          <div className="customers-drawer-grid">
            <div>
              <span className="muted">Lifetime Value</span>
              <strong>{c.ltv != null ? formatMoney(c.ltv) : "Not Available"}</strong>
              <CustomerDataBadge status={c.ltvStatus} />
            </div>
            <div>
              <span className="muted">Average Order Value</span>
              <strong>{formatMoney(c.aov)}</strong>
            </div>
            <div>
              <span className="muted">Total Profit (30d)</span>
              <strong>{formatMoney(c.totalProfit)}</strong>
              <CustomerDataBadge status={c.profitStatus} />
            </div>
            <div>
              <span className="muted">Acquisition Source</span>
              <strong>{c.acquisitionLabel}</strong>
            </div>
            <div>
              <span className="muted">Last Purchase</span>
              <strong>{c.lastPurchaseAt}</strong>
            </div>
            <div>
              <span className="muted">Orders</span>
              <strong>{c.ordersCount}</strong>
            </div>
          </div>
        </section>

        {c.favoriteProducts.length > 0 && (
          <section className="product-attribution-drawer-section">
            <h4>Favorite Products</h4>
            <ul className="customers-drawer-products">
              {c.favoriteProducts.map((p) => (
                <li key={p.productId}>
                  <strong>{p.title}</strong>
                  <span className="muted">
                    {p.units} units · {formatMoney(p.revenue)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {c.purchaseHistory.length > 0 && (
          <section className="product-attribution-drawer-section">
            <h4>Purchase History</h4>
            <div className="customers-drawer-history">
              {c.purchaseHistory.map((order, i) => (
                <div key={i} className="customers-history-row">
                  <span>{order.date}</span>
                  <strong>{formatMoney(order.amount)}</strong>
                  <span className="muted">{order.itemCount} items</span>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="product-attribution-drawer-section recommendation">
          <h4>Recommendations</h4>
          <p style={{ margin: 0, lineHeight: 1.5 }}>{recommendationFor(c)}</p>
        </section>
      </aside>
    </div>
  );
}
