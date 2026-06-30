"use client";

import type { ProductIntelligenceProfile, ProductSortKey } from "@/lib/products/types";
import { useMemo, useState } from "react";

const STATUS_CLASS: Record<ProductIntelligenceProfile["status"], string> = {
  Healthy: "status-healthy",
  "Low Margin": "status-low-margin",
  "Losing Money": "status-losing",
  "Out of Stock": "status-oos",
  "Low Stock": "status-low-stock",
};

const SORT_OPTIONS: { key: ProductSortKey; label: string }[] = [
  { key: "revenue", label: "Revenue" },
  { key: "netProfit", label: "Profit" },
  { key: "marginPct", label: "Margin" },
  { key: "productRoas", label: "ROAS" },
  { key: "revenueGrowthPct", label: "Growth" },
  { key: "daysUntilStockout", label: "Inventory Risk" },
];

function formatMoney(n: number): string {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function sortValue(p: ProductIntelligenceProfile, key: ProductSortKey): number {
  switch (key) {
    case "revenueGrowthPct":
      return p.trends.revenueGrowthPct ?? -999;
    case "daysUntilStockout":
      return p.daysUntilStockout ?? 9999;
    case "productRoas":
      return p.productRoas ?? -1;
    default:
      return p[key] as number;
  }
}

export function ProductIntelligenceGrid({ products }: { products: ProductIntelligenceProfile[] }) {
  const [sortKey, setSortKey] = useState<ProductSortKey>("netProfit");
  const [trendWindow, setTrendWindow] = useState<"last7d" | "last30d">("last30d");

  const sorted = useMemo(() => {
    return [...products].sort((a, b) => sortValue(b, sortKey) - sortValue(a, sortKey));
  }, [products, sortKey]);

  if (products.length === 0) {
    return (
      <div className="card">
        <p className="muted" style={{ margin: 0 }}>No product sales in the last 30 days.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="product-toolbar">
        <div className="product-sort-group">
          <span className="muted" style={{ fontSize: "0.875rem" }}>Sort by</span>
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              type="button"
              className={`chip-btn ${sortKey === opt.key ? "active" : ""}`}
              onClick={() => setSortKey(opt.key)}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="product-sort-group">
          <span className="muted" style={{ fontSize: "0.875rem" }}>Trend</span>
          <button
            type="button"
            className={`chip-btn ${trendWindow === "last7d" ? "active" : ""}`}
            onClick={() => setTrendWindow("last7d")}
          >
            7d
          </button>
          <button
            type="button"
            className={`chip-btn ${trendWindow === "last30d" ? "active" : ""}`}
            onClick={() => setTrendWindow("last30d")}
          >
            30d
          </button>
        </div>
      </div>

      <div className="product-grid">
        {sorted.map((p) => {
          const trend = p.trends[trendWindow];
          const growth = p.trends.revenueGrowthPct;
          return (
            <article key={p.productId} className={`product-card ${p.isLosingMoney ? "losing" : ""}`}>
              <div className="product-card-header">
                {p.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.imageUrl} alt="" className="product-thumb" />
                ) : (
                  <div className="product-thumb product-thumb-placeholder">SKU</div>
                )}
                <div className="product-card-title">
                  <h4>{p.title}</h4>
                  <div className="product-badges">
                    {p.isHero && <span className="hero-badge">⭐ Hero</span>}
                    {p.isHiddenWinner && <span className="hidden-badge">💎 Hidden winner</span>}
                    <span className={`product-status-pill ${STATUS_CLASS[p.status]}`}>{p.status}</span>
                  </div>
                </div>
                <div className="product-health" title={`Health score: ${p.healthScore}/100`}>
                  <strong>{p.healthScore}</strong>
                  <span>{p.healthLabel}</span>
                </div>
              </div>

              <dl className="product-metrics">
                <div><dt>Revenue</dt><dd>{formatMoney(p.revenue)}</dd></div>
                <div><dt>Net Profit</dt><dd className={p.netProfit < 0 ? "negative" : "positive"}>{formatMoney(p.netProfit)}</dd></div>
                <div><dt>Margin</dt><dd>{p.marginPct}%</dd></div>
                <div><dt>ROAS</dt><dd>{p.productRoas?.toFixed(2) ?? "—"}</dd></div>
                <div><dt>Units</dt><dd>{p.unitsSold}</dd></div>
                <div><dt>Refund rate</dt><dd>{p.refundRatePct}%</dd></div>
                <div><dt>Inventory</dt><dd>{p.inventory}</dd></div>
                <div><dt>Trend ({trendWindow === "last7d" ? "7d" : "30d"})</dt>
                  <dd>
                    {formatMoney(trend.netProfit)} profit
                    {growth != null && (
                      <span className={growth >= 0 ? "positive" : "negative"} style={{ marginLeft: 6 }}>
                        {growth >= 0 ? "+" : ""}{growth}%
                      </span>
                    )}
                  </dd>
                </div>
              </dl>

              {p.daysUntilStockout != null && p.daysUntilStockout <= 14 && (
                <p className="product-stockout-note">
                  Expected to sell out in ~{p.daysUntilStockout} days
                </p>
              )}
              {(p.heroReason || p.hiddenWinnerReason) && (
                <p className="product-insight">{p.heroReason ?? p.hiddenWinnerReason}</p>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
