import nextDynamic from "next/dynamic";
import { AnalyticsPageShell } from "@/components/analytics/AnalyticsPageShell";
import { buildSalesPageData } from "@/lib/services/analytics";

const SalesManagerClient = nextDynamic(
  () =>
    import("@/components/analytics/SalesManagerClient").then((m) => ({
      default: m.SalesManagerClient,
    })),
  {
    loading: () => <div className="card skeleton-card analytics-loading-panel" aria-busy="true" />,
  },
);

export const dynamic = "force-dynamic";

export default async function SalesAnalyticsPage() {
  const data = await buildSalesPageData();

  return (
    <AnalyticsPageShell
      title="Sales"
      description="AI Sales Intelligence — how healthy are your sales, where revenue comes from, and what to improve next."
      context="sales"
      syncedAt={data.syncedAt}
    >
      <SalesManagerClient {...data} />
    </AnalyticsPageShell>
  );
}
