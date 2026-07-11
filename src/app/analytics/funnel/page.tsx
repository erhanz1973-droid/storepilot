import { AnalyticsPageShell } from "@/components/analytics/AnalyticsPageShell";
import { FunnelPageClient } from "@/components/funnel/FunnelPageClient";
import { buildFunnelPageData } from "@/lib/services/funnel";

export const dynamic = "force-dynamic";

export default async function FunnelAnalyticsPage() {
  const data = await buildFunnelPageData();

  return (
    <AnalyticsPageShell
      title="Funnel"
      description="Conversion optimization workspace — find drop-offs, prioritize fixes, and improve session-to-purchase performance."
      context="funnel"
      syncedAt={data.syncedAt}
    >
      <FunnelPageClient view={data.view} />
    </AnalyticsPageShell>
  );
}
