"use client";

import type { EnrichedProductCard } from "@/lib/products/page-view";
import { RECOMMENDATION_BADGE_LABELS } from "@/lib/products/recommendations";
import { ATTRIBUTION_CONFIDENCE_LABELS } from "@/lib/attribution/product-types";

function formatMoney(n: number | null): string {
  if (n == null) return "—";
  return n.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function MiniTrend({
  label,
  current,
  previous,
}: {
  label: string;
  current: number;
  previous: number;
}) {
  const max = Math.max(Math.abs(current), Math.abs(previous), 1);
  const curH = Math.max(4, (Math.abs(current) / max) * 48);
  const prevH = Math.max(4, (Math.abs(previous) / max) * 48);
  return (
    <div className="product-mini-trend">
      <span className="muted" style={{ fontSize: "0.75rem" }}>{label}</span>
      <div className="product-mini-trend-bars">
        <div className="bar prev" style={{ height: prevH }} title={`Prior: ${formatMoney(previous)}`} />
        <div
          className={`bar cur ${current < 0 ? "negative" : ""}`}
          style={{ height: curH }}
          title={`Current: ${formatMoney(current)}`}
        />
      </div>
      <span style={{ fontSize: "0.8rem", fontWeight: 600 }}>{formatMoney(current)}</span>
    </div>
  );
}

type Props = {
  product: EnrichedProductCard | null;
  open: boolean;
  onClose: () => void;
};

export function ProductMerchandisingDrawer({ product, open, onClose }: Props) {
  if (!open || !product) return null;

  const p = product;
  const growth = p.trends.revenueGrowthPct;

  return (
    <div className="product-attribution-drawer-backdrop" onClick={onClose} role="presentation">
      <aside
        className="product-attribution-drawer product-merch-drawer"
        onClick={(e) => e.stopPropagation()}
        aria-label={`${p.title} details`}
      >
        <div className="product-attribution-drawer-header">
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            {p.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.imageUrl} alt="" className="product-thumb" style={{ width: 56, height: 56 }} />
            ) : (
              <div className="product-thumb product-thumb-placeholder" style={{ width: 56, height: 56 }}>
                SKU
              </div>
            )}
            <div>
              <h3 style={{ margin: 0 }}>{p.title}</h3>
              <p className="muted" style={{ margin: "4px 0 0", fontSize: "0.85rem" }}>
                {p.sku} · {p.collectionTitle} · {p.displayStatus} · Health {p.healthScore}/100 ({p.healthTier})
              </p>
            </div>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            Close
          </button>
        </div>

        <section className="product-attribution-drawer-section product-ai-analysis">
          <h4>AI Merchandising Analysis</h4>
          <p style={{ margin: "0 0 8px", lineHeight: 1.5, fontWeight: 600 }}>
            {p.lifecycleStage} · {p.displayStatus}
          </p>
          <ul className="product-rec-reasoning">
            {p.recommendation.reasoning.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <p style={{ margin: "8px 0", lineHeight: 1.5 }}>
            <strong>Recommendation:</strong> {p.recommendation.action}
          </p>
          <p style={{ margin: "0 0 8px", lineHeight: 1.5 }}>{p.recommendation.aiExplanation}</p>
          <div className="product-ai-impact">
            <div>
              <span className="muted" style={{ fontSize: "0.75rem" }}>Recommendation</span>
              <strong>{RECOMMENDATION_BADGE_LABELS[p.recommendation.badge]}</strong>
            </div>
            {p.recommendation.expectedMonthlyImpact > 0 && (
              <div>
                <span className="muted" style={{ fontSize: "0.75rem" }}>
                  Expected monthly improvement
                </span>
                <strong className="positive">
                  +{formatMoney(p.recommendation.expectedMonthlyImpact)}
                </strong>
              </div>
            )}
            <div>
              <span className="muted" style={{ fontSize: "0.75rem" }}>Confidence</span>
              <strong>{p.recommendation.confidencePct}%</strong>
            </div>
          </div>
        </section>

        {p.merchandisingInsights.length > 0 && (
          <section className="product-attribution-drawer-section">
            <h4>Merchandising Insights</h4>
            <ul className="product-merch-insight-list">
              {p.merchandisingInsights.map((insight) => (
                <li key={insight.id} className={`insight-${insight.severity}`}>
                  {insight.text}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="product-attribution-drawer-section">
          <h4>Product Health Score</h4>
          <p style={{ margin: "0 0 10px" }}>
            <strong>{p.healthScore}</strong>/100 · {p.healthTier}
          </p>
          <div className="product-health-breakdown">
            {p.healthBreakdown.map((factor) => (
              <div key={factor.id} className="product-health-factor">
                <div className="product-health-factor-head">
                  <span>{factor.label}</span>
                  <strong>
                    {factor.score}/{factor.maxScore}
                  </strong>
                </div>
                <div className="product-health-bar">
                  <div
                    className="product-health-bar-fill"
                    style={{ width: `${(factor.score / factor.maxScore) * 100}%` }}
                  />
                </div>
                <p className="muted" style={{ margin: "4px 0 0", fontSize: "0.78rem" }}>
                  {factor.explanation}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="product-attribution-drawer-section">
          <h4>Revenue &amp; Profit Trend</h4>
          <div className="product-trend-row">
            <MiniTrend
              label="Revenue (30d)"
              current={p.trends.last30d.revenue}
              previous={p.trends.previous30d.revenue}
            />
            <MiniTrend
              label="Net Profit (30d)"
              current={p.trends.last30d.netProfit}
              previous={p.trends.previous30d.netProfit}
            />
          </div>
          {growth != null && (
            <p className="muted" style={{ margin: "8px 0 0", fontSize: "0.85rem" }}>
              Revenue {growth >= 0 ? "up" : "down"} {Math.abs(growth)}% vs prior 30 days
            </p>
          )}
        </section>

        <section className="product-attribution-drawer-section">
          <h4>Traffic Sources</h4>
          <div className="product-attribution-source-grid">
            <div><span className="muted">Meta</span><strong>{formatMoney(p.metaRevenue)}</strong></div>
            <div><span className="muted">Google</span><strong>{formatMoney(p.googleRevenue)}</strong></div>
            <div><span className="muted">Organic</span><strong>{formatMoney(p.organicRevenue)}</strong></div>
            <div><span className="muted">Email</span><strong>{formatMoney(p.emailRevenue)}</strong></div>
            <div><span className="muted">Direct</span><strong>{formatMoney(p.directRevenue)}</strong></div>
          </div>
        </section>

        <section className="product-attribution-drawer-section">
          <h4>Advertising Breakdown</h4>
          <div className="product-attribution-source-grid">
            <div>
              <span className="muted">Meta Spend</span>
              <strong>
                {formatMoney(p.metaSpend)}
                {p.adCostEstimated && p.metaSpend != null && (
                  <span className="cost-est-badge">est.</span>
                )}
              </strong>
            </div>
            <div>
              <span className="muted">Google Spend</span>
              <strong>
                {formatMoney(p.googleSpend)}
                {p.adCostEstimated && p.googleSpend != null && (
                  <span className="cost-est-badge">est.</span>
                )}
              </strong>
            </div>
            <div>
              <span className="muted">Total Ad Cost</span>
              <strong>{formatMoney(p.adCost)}</strong>
            </div>
            <div>
              <span className="muted">Attribution</span>
              <strong>
                {p.attributionMethodLabel}
                {p.attribution && (
                  <span className="muted" style={{ display: "block", fontSize: "0.75rem" }}>
                    {p.attributionConfidencePct}% ·{" "}
                    {ATTRIBUTION_CONFIDENCE_LABELS[p.attribution.confidenceLevel]}
                  </span>
                )}
              </strong>
            </div>
          </div>
        </section>

        <section className="product-attribution-drawer-section">
          <h4>Inventory</h4>
          <p style={{ margin: "0 0 12px" }}>
            {p.inventory} units · {p.unitsSold} sold (30d)
            {p.daysUntilStockout != null && (
              <span className="muted"> · ~{p.daysUntilStockout} days of cover</span>
            )}
          </p>
          {p.inventoryHistory.length > 0 && (
            <div className="product-inventory-history">
              <span className="muted" style={{ fontSize: "0.75rem" }}>Inventory history (4 weeks)</span>
              <div className="product-inventory-history-bars">
                {p.inventoryHistory.map((point) => {
                  const max = Math.max(...p.inventoryHistory.map((h) => h.quantity), 1);
                  const h = Math.max(4, (point.quantity / max) * 48);
                  return (
                    <div key={point.week} className="product-inventory-point" title={`${point.week}: ${point.quantity} units`}>
                      <div className="bar" style={{ height: h }} />
                      <span className="muted">{point.quantity}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        {p.relatedProducts.length > 0 && (
          <section className="product-attribution-drawer-section">
            <h4>Related Products</h4>
            <ul className="product-related-list">
              {p.relatedProducts.map((related) => (
                <li key={related.productId}>
                  <strong>{related.title}</strong>
                  <span className="muted">{related.reason}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {p.recentOrders.length > 0 && (
          <section className="product-attribution-drawer-section">
            <h4>Recent Orders</h4>
            <ul className="product-recent-orders-list">
              {p.recentOrders.map((order) => (
                <li key={order.orderId}>
                  <div>
                    <strong>{order.externalId}</strong>
                    <span className="muted"> · {order.customer}</span>
                  </div>
                  <span>{formatMoney(order.revenue)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {p.attribution && p.attribution.campaigns.length > 0 && (
          <section className="product-attribution-drawer-section">
            <h4>Campaign Attribution</h4>
            <ul className="product-attribution-campaign-list">
              {p.attribution.campaigns.map((c) => (
                <li key={c.campaignId}>
                  <strong>{c.campaignName}</strong>
                  <span className="muted">
                    {formatMoney(c.attributedSpend)} spend · {c.confidencePct}% confidence
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </aside>
    </div>
  );
}
