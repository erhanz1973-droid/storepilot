import { AnalyticsPageShell } from "@/components/analytics/AnalyticsPageShell";
import { ProductsPageClient } from "@/components/products/ProductsPageClient";
import { buildProductsPageData } from "@/lib/services/products";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ProductsAnalyticsPage() {
  const data = await buildProductsPageData();

  if (!data) {
    return (
      <AnalyticsPageShell
        title="Products"
        description="AI merchandising manager — profit, advertising, inventory, and recovery opportunities per SKU."
        context="products"
      >
        <div className="card">
          <p className="muted" style={{ margin: 0 }}>
            Connect Shopify to analyze products.{" "}
            <Link href="/connections">Open Connections</Link>
          </p>
        </div>
      </AnalyticsPageShell>
    );
  }

  return (
    <AnalyticsPageShell
      title="Products"
      description="AI merchandising manager — know which products to scale, discount, restock, or stop advertising."
      context="products"
      syncedAt={data.intelligence.syncedAt}
    >
      <ProductsPageClient view={data.view} />
    </AnalyticsPageShell>
  );
}
