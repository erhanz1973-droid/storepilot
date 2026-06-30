"use client";

import type { EnrichedProductCard } from "@/lib/products/page-view";
import { RECOMMENDATION_BADGE_LABELS } from "@/lib/products/recommendations";
import { memo, useCallback, useMemo, useState } from "react";

const PAGE_SIZE = 40;

function fmt(n: number): string {
  return n.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function healthClass(tier: EnrichedProductCard["healthTier"]) {
  return `product-catalog-health health-tier-${tier.toLowerCase().replace(/\s+/g, "-")}`;
}

const CatalogRow = memo(function CatalogRow({
  product: p,
  highlighted,
  onSelect,
}: {
  product: EnrichedProductCard;
  highlighted: boolean;
  onSelect: (product: EnrichedProductCard) => void;
}) {
  return (
    <tr
      className={`product-catalog-row ${highlighted ? "ai-highlight" : ""} ${p.isLosingMoney ? "losing" : ""}`}
      onClick={() => onSelect(p)}
    >
      <td className="product-catalog-product-cell">
        <div className="product-catalog-product">
          {p.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={p.imageUrl}
              alt=""
              className="product-thumb product-catalog-thumb"
              loading="lazy"
            />
          ) : (
            <div className="product-thumb product-thumb-placeholder product-catalog-thumb">SKU</div>
          )}
          <div>
            <strong>{p.title}</strong>
            <span className="muted product-catalog-meta">
              {p.collectionTitle} · {p.lifecycleStage}
            </span>
          </div>
        </div>
      </td>
      <td>{p.sku}</td>
      <td>{fmt(p.revenue)}</td>
      <td className={p.netProfit < 0 ? "negative" : "positive"}>{fmt(p.netProfit)}</td>
      <td>{p.marginPct}%</td>
      <td>{p.inventory}</td>
      <td>
        {p.daysUntilStockout != null ? `~${p.daysUntilStockout}` : p.inventory === 0 ? "0" : "—"}
      </td>
      <td>{p.productRoas?.toFixed(2) ?? "—"}</td>
      <td>
        <span className={healthClass(p.healthTier)}>{p.healthScore}</span>
      </td>
      <td>
        <span className={`product-catalog-rec rec-${p.recommendation.badge}`}>
          {RECOMMENDATION_BADGE_LABELS[p.recommendation.badge]}
        </span>
      </td>
    </tr>
  );
});

type Props = {
  products: EnrichedProductCard[];
  highlightedProductIds: Set<string>;
  onSelect: (product: EnrichedProductCard) => void;
};

export function ProductCatalogTable({ products, highlightedProductIds, onSelect }: Props) {
  const [page, setPage] = useState(0);
  const stableOnSelect = useCallback((p: EnrichedProductCard) => onSelect(p), [onSelect]);

  const pageCount = Math.max(1, Math.ceil(products.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageProducts = useMemo(
    () => products.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE),
    [products, safePage],
  );

  return (
    <section className="card product-catalog-section">
      <div className="product-catalog-header">
        <div>
          <h3 style={{ margin: 0 }}>Product Catalog</h3>
          <p className="muted" style={{ margin: "4px 0 0", fontSize: "0.875rem" }}>
            {products.length} SKUs — showing {pageProducts.length} per page
          </p>
        </div>
      </div>

      <div className="product-catalog-table-wrap">
        <table className="product-catalog-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>SKU</th>
              <th>Revenue</th>
              <th>Net Profit</th>
              <th>Margin</th>
              <th>Inventory</th>
              <th>Days of Stock</th>
              <th>ROAS</th>
              <th>Health</th>
              <th>Recommendation</th>
            </tr>
          </thead>
          <tbody>
            {pageProducts.map((p) => (
              <CatalogRow
                key={p.productId}
                product={p}
                highlighted={highlightedProductIds.has(p.productId)}
                onSelect={stableOnSelect}
              />
            ))}
          </tbody>
        </table>
      </div>

      {products.length > PAGE_SIZE && (
        <div className="performance-table-pagination">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={safePage === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            Previous
          </button>
          <span className="muted">
            Page {safePage + 1} of {pageCount}
          </span>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={safePage >= pageCount - 1}
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
          >
            Next
          </button>
        </div>
      )}
    </section>
  );
}
