import type { ProductProfitCategories } from "@/lib/profit/profit-page-view";

function formatMoney(n: number): string {
  return n.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function CategoryColumn({ category }: { category: ProductProfitCategories["mostProfitable"] }) {
  return (
    <div className="profit-product-category">
      <h4>{category.title}</h4>
      {category.products.length === 0 ? (
        <p className="muted">No products in this category yet.</p>
      ) : (
        <ul>
          {category.products.map((p) => (
            <li key={p.productId}>
              <strong>{p.title}</strong>
              <span className="profit-product-category-metrics">
                {formatMoney(p.netProfit)} · {p.marginPct}% margin
              </span>
              <span className="muted profit-product-category-insight">{p.insight}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ProductProfitCategoriesSection({
  categories,
}: {
  categories: ProductProfitCategories;
}) {
  return (
    <section className="card profit-product-categories">
      <h3 style={{ marginTop: 0 }}>Product Profitability</h3>
      <p className="muted" style={{ margin: "0 0 16px", fontSize: "0.875rem" }}>
        Winners, over-advertised SKUs, and growth opportunities — not just problem products.
      </p>
      <div className="profit-product-categories-grid">
        <CategoryColumn category={categories.mostProfitable} />
        <CategoryColumn category={categories.mostOverAdvertised} />
        <CategoryColumn category={categories.highestGrowth} />
      </div>
    </section>
  );
}
