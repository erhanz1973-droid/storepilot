import { AnalyticsPageShell } from "@/components/analytics/AnalyticsPageShell";
import { AttributionAnalyticsContent } from "@/components/analytics/AttributionAnalyticsContent";
import { buildAttributionIntelligenceDashboard } from "@/lib/services/attribution";

export const dynamic = "force-dynamic";

export default async function AnalyticsAttributionPage() {
  const dashboard = await buildAttributionIntelligenceDashboard();

  return (
    <AnalyticsPageShell
      title="Attribution"
      description="Customer journey and multi-touch models — first click, last click, linear, and blended."
      context="attribution"
      syncedAt={dashboard?.syncedAt}
    >
      <AttributionAnalyticsContent dashboard={dashboard} />
    </AnalyticsPageShell>
  );
}
