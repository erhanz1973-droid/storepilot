import nextDynamic from "next/dynamic";
import { AnalyticsPageShell } from "@/components/analytics/AnalyticsPageShell";
import { buildTrafficPageData } from "@/lib/services/analytics";

const TrafficManagerClient = nextDynamic(
  () =>
    import("@/components/analytics/TrafficManagerClient").then((m) => ({
      default: m.TrafficManagerClient,
    })),
  {
    loading: () => <div className="card skeleton-card analytics-loading-panel" aria-busy="true" />,
  },
);

export const dynamic = "force-dynamic";

export default async function TrafficAnalyticsPage() {
  const data = await buildTrafficPageData();

  return (
    <AnalyticsPageShell
      title="Traffic"
      description="AI Traffic Intelligence — which traffic creates profit and which traffic wastes acquisition cost."
      context="traffic"
      syncedAt={data.syncedAt}
    >
      <TrafficManagerClient charts={data.charts} v2={data.v2} />
    </AnalyticsPageShell>
  );
}
