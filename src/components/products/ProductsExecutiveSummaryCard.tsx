import type { ProductsExecutiveSummary } from "@/lib/products/page-view";

function formatMoney(n: number): string {
  return n.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

export function ProductsExecutiveSummaryCard({
  summary,
}: {
  summary: ProductsExecutiveSummary;
}) {
  return (
    <div className="card products-executive-summary">
      <h3 style={{ margin: "0 0 12px" }}>Products Summary</h3>
      <div className="products-summary-stats">
        <div>
          <span className="muted">Catalog SKUs</span>
          <strong>{summary.totalProducts}</strong>
        </div>
        <div>
          <span className="muted">Active (30d)</span>
          <strong>{summary.activeProducts}</strong>
        </div>
        <div>
          <span className="muted">Profitable</span>
          <strong className="positive">{summary.profitable}</strong>
        </div>
        <div>
          <span className="muted">Losing Money</span>
          <strong className={summary.losingMoney > 0 ? "negative" : ""}>
            {summary.losingMoney}
          </strong>
        </div>
        <div>
          <span className="muted">Out of Stock</span>
          <strong>{summary.outOfStock}</strong>
        </div>
        <div>
          <span className="muted">Dead Inventory</span>
          <strong>{summary.deadInventory}</strong>
        </div>
      </div>

      <div className="products-summary-highlights">
        {summary.highestProfitProduct && (
          <div>
            <span className="muted" style={{ fontSize: "0.8rem" }}>
              Highest Profit Product
            </span>
            <strong>{summary.highestProfitProduct.title}</strong>
            <span className="positive" style={{ fontSize: "0.85rem" }}>
              {formatMoney(summary.highestProfitProduct.netProfit)}
            </span>
          </div>
        )}
        {summary.biggestOpportunity && (
          <div className="products-summary-opportunity">
            <span className="muted" style={{ fontSize: "0.8rem" }}>
              Biggest Opportunity
            </span>
            <strong>
              {summary.biggestOpportunity.title} — {summary.biggestOpportunity.productTitle}
            </strong>
            <span className="positive" style={{ fontSize: "0.85rem" }}>
              +{formatMoney(summary.biggestOpportunity.estimatedMonthlyImpact)}/mo
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
