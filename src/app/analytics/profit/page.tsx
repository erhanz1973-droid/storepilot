import { AnalyticsPageShell } from "@/components/analytics/AnalyticsPageShell";
import { ProfitAnalyticsContent } from "@/components/analytics/ProfitAnalyticsContent";
import { buildProfitPageData } from "@/lib/services/profit";

export const dynamic = "force-dynamic";

export default async function AnalyticsProfitPage() {
  const data = await buildProfitPageData();

  return (
    <AnalyticsPageShell
      title="Profit"
      description="Real profitability — revenue minus COGS, fees, refunds, and ad spend."
      context="profit"
      syncedAt={data?.dashboard.syncedAt}
    >
      <ProfitAnalyticsContent data={data} />
    </AnalyticsPageShell>
  );
}
