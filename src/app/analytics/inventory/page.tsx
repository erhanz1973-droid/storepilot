import { AnalyticsPageShell } from "@/components/analytics/AnalyticsPageShell";
import { InventoryPageClient } from "@/components/inventory/InventoryPageClient";
import { buildInventoryPageData } from "@/lib/services/inventory";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function InventoryAnalyticsPage() {
  const data = await buildInventoryPageData();

  if (!data) {
    return (
      <AnalyticsPageShell
        title="Inventory"
        description="Dead stock, velocity, stockouts, and AI clearance or restock suggestions."
        context="inventory"
      >
        <div className="card">
          <p className="muted" style={{ margin: 0 }}>
            Connect Shopify to analyze inventory.{" "}
            <Link href="/connections">Open Connections</Link>
          </p>
        </div>
      </AnalyticsPageShell>
    );
  }

  return (
    <AnalyticsPageShell
      title="Inventory"
      description="Dead stock, velocity, stockouts, and AI clearance or restock suggestions."
      context="inventory"
      syncedAt={data.syncedAt}
    >
      <InventoryPageClient view={data.view} />
    </AnalyticsPageShell>
  );
}
