import { AnalyticsPageShell } from "@/components/analytics/AnalyticsPageShell";
import { CustomersPageClient } from "@/components/customers/CustomersPageClient";
import { buildCustomersPageData } from "@/lib/services/customers";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function CustomersAnalyticsPage() {
  const data = await buildCustomersPageData();

  if (!data) {
    return (
      <AnalyticsPageShell
        title="Customers"
        description="Customer intelligence — segments, LTV, acquisition, and retention opportunities."
        context="customers"
      >
        <div className="card">
          <p className="muted" style={{ margin: 0 }}>
            Connect Shopify to analyze customers.{" "}
            <Link href="/connections">Open Connections</Link>
          </p>
        </div>
      </AnalyticsPageShell>
    );
  }

  return (
    <AnalyticsPageShell
      title="Customers"
      description="Customer intelligence dashboard — know who creates the most value, who is at risk, and where your best customers come from."
      context="customers"
      syncedAt={data.syncedAt}
    >
      <CustomersPageClient view={data.view} />
    </AnalyticsPageShell>
  );
}
