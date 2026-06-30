import type { ProductAttributionDashboard } from "@/lib/attribution/product-types";

function formatMoney(n: number): string {
  return n.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function WidgetColumn({
  widget,
}: {
  widget: ProductAttributionDashboard["widgets"][keyof ProductAttributionDashboard["widgets"]];
}) {
  if (widget.products.length === 0) return null;
  return (
    <div className="card product-attribution-widget">
      <h4 style={{ margin: "0 0 10px", fontSize: "0.9rem" }}>{widget.label}</h4>
      <ul className="product-attribution-widget-list">
        {widget.products.map((p) => (
          <li key={p.productId}>
            <span className="product-attribution-widget-title">{p.title}</span>
            <span className="product-attribution-widget-value">
              {widget.id.includes("margin")
                ? `${p.value}%`
                : widget.id.includes("roas")
                  ? p.value.toFixed(2)
                  : formatMoney(p.value)}
            </span>
            {p.sublabel && (
              <span className="muted product-attribution-widget-sub">{p.sublabel}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ProductAttributionWidgets({
  attribution,
}: {
  attribution: ProductAttributionDashboard;
}) {
  const { widgets } = attribution;

  return (
    <div className="product-attribution-widgets-section">
      <div className="product-attribution-widgets-header">
        <h3 style={{ margin: 0 }}>Product Attribution Insights</h3>
        <span className="muted" style={{ fontSize: "0.85rem" }}>
          {attribution.overallConfidencePct}% average attribution confidence
        </span>
      </div>
      <div className="product-attribution-widgets-grid">
        <WidgetColumn widget={widgets.topByProfit} />
        <WidgetColumn widget={widgets.topByRoas} />
        <WidgetColumn widget={widgets.topByOrganic} />
        <WidgetColumn widget={widgets.mostExpensiveToAdvertise} />
        <WidgetColumn widget={widgets.losingMoney} />
        <WidgetColumn widget={widgets.highestAdCost} />
        <WidgetColumn widget={widgets.highestMargin} />
      </div>
    </div>
  );
}
