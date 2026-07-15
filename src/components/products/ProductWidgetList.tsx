import type { ProductWidgetRow } from "@/lib/products/types";
import Link from "next/link";

function formatValue(row: ProductWidgetRow): string {
  if (row.valueLabel === "margin" || row.valueLabel === "refund rate") {
    return row.sublabel ?? `${row.value}%`;
  }
  if (row.valueLabel === "growth") {
    return row.sublabel ?? `+${row.value}%`;
  }
  if (row.valueLabel === "ROAS") {
    return row.sublabel ?? row.value.toFixed(2);
  }
  return row.sublabel ?? `$${row.value.toLocaleString()}`;
}

export function ProductWidgetList({
  title,
  rows,
  href = "/products",
  emptyMessage = "We're still analyzing product performance for this store.",
}: {
  title: string;
  rows: ProductWidgetRow[];
  href?: string;
  emptyMessage?: string;
}) {
  return (
    <div className="card product-widget-card">
      <div className="product-widget-header">
        <h3>{title}</h3>
        {rows.length > 0 && (
          <Link href={href} className="widget-drill-link">
            View all →
          </Link>
        )}
      </div>
      {rows.length === 0 ? (
        <p className="muted" style={{ margin: 0, fontSize: "0.875rem" }}>{emptyMessage}</p>
      ) : (
        <ul className="product-widget-list">
          {rows.map((row) => (
            <li key={row.productId}>
              <Link href={href} className="product-widget-row">
                {row.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={row.imageUrl} alt="" className="product-widget-thumb" />
                ) : (
                  <span className="product-widget-thumb product-widget-thumb-ph" />
                )}
                <span className="product-widget-name">{row.title}</span>
                <span className="product-widget-value">{formatValue(row)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
