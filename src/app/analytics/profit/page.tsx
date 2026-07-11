import { AnalyticsPageShell } from "@/components/analytics/AnalyticsPageShell";
import { ProfitAnalyticsContent } from "@/components/analytics/ProfitAnalyticsContent";
import { buildProfitPageData } from "@/lib/services/profit";

export const dynamic = "force-dynamic";

export default async function AnalyticsProfitPage() {
  const data = await buildProfitPageData();

  return (
    <AnalyticsPageShell
      title="Profit"
      description="Your daily financial briefing — net profit, where margin is lost, and the single most important action today."
      context="profit"
      syncedAt={data?.dashboard.syncedAt}
    >
      <ProfitAnalyticsContent data={data} />
    </AnalyticsPageShell>
  );
}
