"use client";

import type { ProductAttributionProfile } from "@/lib/attribution/product-types";
import { ATTRIBUTION_CONFIDENCE_LABELS } from "@/lib/attribution/product-types";

function formatMoney(n: number | null): string {
  if (n == null) return "Unknown";
  return n.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

type Props = {
  product: ProductAttributionProfile | null;
  open: boolean;
  onClose: () => void;
};

export function ProductAttributionDetailDrawer({ product, open, onClose }: Props) {
  if (!open || !product) return null;

  const sources = [
    { label: "Meta", value: product.sources.meta },
    { label: "Google", value: product.sources.google },
    { label: "Organic", value: product.sources.organic },
    { label: "Direct", value: product.sources.direct },
    { label: "Email", value: product.sources.email },
    { label: "Referral", value: product.sources.referral },
  ].filter((s) => s.value > 0);

  return (
    <div className="product-attribution-drawer-backdrop" onClick={onClose} role="presentation">
      <div
        className="product-attribution-drawer"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={`${product.title} attribution`}
      >
        <div className="product-attribution-drawer-header">
          <div>
            <h3 style={{ margin: 0 }}>{product.title}</h3>
            <p className="muted" style={{ margin: "4px 0 0", fontSize: "0.85rem" }}>
              {product.methodLabel} · {product.confidencePct}% ·{" "}
              {ATTRIBUTION_CONFIDENCE_LABELS[product.confidenceLevel]}
            </p>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            Close
          </button>
        </div>

        <section className="product-attribution-drawer-section">
          <h4>Revenue Sources</h4>
          <div className="product-attribution-source-grid">
            {sources.length > 0 ? (
              sources.map((s) => (
                <div key={s.label}>
                  <span className="muted">{s.label}</span>
                  <strong>{formatMoney(s.value)}</strong>
                </div>
              ))
            ) : (
              <p className="muted" style={{ margin: 0 }}>
                Primary source: {product.primaryTrafficSource}
              </p>
            )}
          </div>
        </section>

        <section className="product-attribution-drawer-section">
          <h4>Advertising Cost Breakdown</h4>
          <div className="product-attribution-source-grid">
            <div>
              <span className="muted">Meta Spend</span>
              <strong>
                {formatMoney(product.adCost.metaSpend)}
                {product.adCost.isEstimated && product.adCost.metaSpend != null && (
                  <span className="cost-est-badge">est.</span>
                )}
              </strong>
            </div>
            <div>
              <span className="muted">Google Spend</span>
              <strong>
                {formatMoney(product.adCost.googleSpend)}
                {product.adCost.isEstimated && product.adCost.googleSpend != null && (
                  <span className="cost-est-badge">est.</span>
                )}
              </strong>
            </div>
            <div>
              <span className="muted">Total Ad Cost</span>
              <strong>
                {product.adCost.isUnknown ? "Unknown" : formatMoney(product.adCost.totalSpend)}
              </strong>
            </div>
          </div>
        </section>

        <section className="product-attribution-drawer-section">
          <h4>Profit Breakdown</h4>
          <table className="product-attribution-breakdown-table">
            <tbody>
              <tr><td>Revenue</td><td>{formatMoney(product.revenue)}</td></tr>
              <tr><td>COGS</td><td>−{formatMoney(product.cogs)}</td></tr>
              <tr><td>Shipping</td><td>−{formatMoney(product.shippingCost)}</td></tr>
              <tr><td>Payment Fees</td><td>−{formatMoney(product.paymentFees)}</td></tr>
              <tr><td>Advertising</td><td>−{formatMoney(product.adCost.totalSpend)}</td></tr>
              <tr className="total">
                <td>Net Profit</td>
                <td className={product.netProfit < 0 ? "negative" : "positive"}>
                  {formatMoney(product.netProfit)}
                </td>
              </tr>
              <tr><td>Margin</td><td>{product.marginPct}%</td></tr>
              <tr><td>ROAS</td><td>{product.roas?.toFixed(2) ?? "—"}</td></tr>
            </tbody>
          </table>
        </section>

        {product.campaigns.length > 0 && (
          <section className="product-attribution-drawer-section">
            <h4>Campaign Attribution</h4>
            <ul className="product-attribution-campaign-list">
              {product.campaigns.map((c) => (
                <li key={c.campaignId}>
                  <strong>{c.campaignName}</strong>
                  <span className="muted">
                    {c.channel} · {formatMoney(c.attributedSpend)} spend · {c.confidencePct}%
                    confidence
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="product-attribution-drawer-section recommendation">
          <h4>Recommendation</h4>
          <p style={{ margin: 0 }}>{product.recommendation}</p>
        </section>
      </div>
    </div>
  );
}
