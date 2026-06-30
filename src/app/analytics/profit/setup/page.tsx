import { AnalyticsPageShell } from "@/components/analytics/AnalyticsPageShell";
import { ProductCostEditor } from "@/components/profit/ProductCostEditor";
import { ProfitSetupWizard } from "@/components/profit/ProfitSetupWizard";
import { ProfitConfidenceBanner } from "@/components/profit/ProfitConfidenceBanner";
import { buildProfitDashboard } from "@/lib/services/profit";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ProfitSetupPage() {
  const dashboard = await buildProfitDashboard();

  return (
    <AnalyticsPageShell
      title="Profit Setup"
      description="Configure the data sources required for accurate profit analytics."
      context="profit"
      syncedAt={dashboard?.syncedAt}
    >
      {!dashboard ? (
        <div className="card">
          <p className="muted" style={{ margin: 0 }}>
            Connect Shopify first to begin profit setup.{" "}
            <Link href="/connections?tab=commerce">Connect your store</Link>
          </p>
        </div>
      ) : (
        <>
          <ProfitConfidenceBanner confidence={dashboard.confidence} />
          <ProfitSetupWizard confidence={dashboard.confidence} />
          <div style={{ marginTop: 16 }} id="product-costs">
            <ProductCostEditor
              products={dashboard.byProduct
                .filter((p) => p.costSource === "estimated")
                .map((p) => ({
                  productId: p.productId,
                  title: p.title,
                  unitCost: null,
                  costSource: p.costSource,
                }))}
            />
          </div>
          <p className="muted" style={{ marginTop: 16 }}>
            <Link href="/analytics/profit">← Back to Profit analytics</Link>
          </p>
        </>
      )}
    </AnalyticsPageShell>
  );
}
