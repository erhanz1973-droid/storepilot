import { AnalyticsPageShell } from "@/components/analytics/AnalyticsPageShell";
import { FunnelPageClient } from "@/components/funnel/FunnelPageClient";
import { buildFunnelPageData } from "@/lib/services/funnel";

export const dynamic = "force-dynamic";

export default async function FunnelAnalyticsPage() {
  const data = await buildFunnelPageData();

  return (
    <AnalyticsPageShell
      title="Funnel"
      description={
        data.view.mode === "full"
          ? "Session-to-purchase conversion — where users drop and what AI recommends fixing."
          : "Funnel readiness — understand what's available now and what GA4 unlocks."
      }
      context="funnel"
      syncedAt={data.syncedAt}
    >
      <FunnelPageClient view={data.view} />
    </AnalyticsPageShell>
  );
}
