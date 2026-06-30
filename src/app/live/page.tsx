import { AnalyticsPageShell } from "@/components/analytics/AnalyticsPageShell";
import { LiveMissionControlClient } from "@/components/live/LiveMissionControlClient";
import { buildLiveMissionControl } from "@/lib/services/analytics";

export const dynamic = "force-dynamic";

export default async function LivePage() {
  const view = await buildLiveMissionControl();

  return (
    <AnalyticsPageShell
      title="Live Dashboard"
      description="Mission control for your store — what is happening right now, what needs attention, and what to do next."
      context="live"
      syncedAt={view.syncedAt}
      showDateRange={false}
    >
      <LiveMissionControlClient initialView={view} />
    </AnalyticsPageShell>
  );
}
