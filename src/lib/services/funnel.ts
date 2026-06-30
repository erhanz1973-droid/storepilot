import { buildAttributionDashboard } from "@/lib/attribution/engine";
import { buildFunnelPageView } from "@/lib/funnel/engine";
import type { FunnelPageView } from "@/lib/funnel/types";
import { getCachedStoreBundle } from "@/lib/services/store-bundle";

export async function buildFunnelPageData(): Promise<{
  view: FunnelPageView;
  syncedAt: string;
}> {
  const bundle = await getCachedStoreBundle();
  const attribution = buildAttributionDashboard(bundle.snapshot, bundle.profitDashboard);

  return {
    view: buildFunnelPageView({
      snapshot: bundle.snapshot,
      attribution,
      profitDashboard: bundle.profitDashboard,
    }),
    syncedAt: bundle.snapshot.syncedAt,
  };
}
