"use client";

import { ProductCatalogTable } from "@/components/products/ProductCatalogTable";
import { ProductMerchandisingDrawer } from "@/components/products/ProductMerchandisingDrawer";
import { ProductsExecutiveSummaryCard } from "@/components/products/ProductsExecutiveSummaryCard";
import { ProductsRecoverySection } from "@/components/products/ProductsRecoverySection";
import {
  filterProducts,
  PRODUCT_FILTER_LABELS,
  type EnrichedProductCard,
  type ProductFilterId,
  type ProductsPageView,
} from "@/lib/products/page-view";
import { useMemo, useState } from "react";

const FILTERS: ProductFilterId[] = [
  "all",
  "most_profitable",
  "highest_roas",
  "highest_margin",
  "fastest_growing",
  "inventory_risk",
  "dead_inventory",
  "losing_money",
  "organic_winners",
  "advertising_winners",
  "advertising_losers",
];

export function ProductsPageClient({ view }: { view: ProductsPageView }) {
  const [filter, setFilter] = useState<ProductFilterId>("all");
  const [drawerProduct, setDrawerProduct] = useState<EnrichedProductCard | null>(null);

  const highlightedProductIds = useMemo(
    () => new Set(view.recovery.opportunities.map((o) => o.productId)),
    [view.recovery.opportunities],
  );

  const catalogProducts = useMemo(() => {
    const filtered = filterProducts(view.products, filter);
    if (filter === "all") {
      return [...filtered].sort((a, b) => b.revenue - a.revenue);
    }
    return filtered;
  }, [view.products, filter]);

  if (view.products.length === 0) {
    return (
      <div className="card">
        <p className="muted" style={{ margin: 0 }}>
          No product sales in the last 30 days.
        </p>
      </div>
    );
  }

  return (
    <div className="products-page">
      <ProductsExecutiveSummaryCard summary={view.executiveSummary} />
      <ProductsRecoverySection recovery={view.recovery} allHealthy={view.allHealthy} />

      <div className="product-toolbar products-filter-toolbar">
        <div className="product-sort-group product-filter-chips">
          {FILTERS.map((id) => (
            <button
              key={id}
              type="button"
              className={`chip-btn ${filter === id ? "active" : ""}`}
              onClick={() => setFilter(id)}
            >
              {PRODUCT_FILTER_LABELS[id]}
            </button>
          ))}
        </div>
      </div>

      <ProductCatalogTable
        products={catalogProducts}
        highlightedProductIds={highlightedProductIds}
        onSelect={setDrawerProduct}
      />

      {catalogProducts.length === 0 && (
        <div className="card" style={{ marginTop: 12 }}>
          <p className="muted" style={{ margin: 0 }}>
            No products match this filter.
          </p>
        </div>
      )}

      <ProductMerchandisingDrawer
        product={drawerProduct}
        open={drawerProduct != null}
        onClose={() => setDrawerProduct(null)}
      />
    </div>
  );
}
