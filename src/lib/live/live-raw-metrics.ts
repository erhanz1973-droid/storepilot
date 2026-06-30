import type { StoreBundle } from "@/lib/services/store-bundle";
import type { LivePageRawData } from "./mission-control";

/** Fast live metrics from cached bundle — no monitors, opportunities, or AI event scans. */
export function buildLiveRawMetricsFast(bundle: StoreBundle): LivePageRawData {
  const { snapshot, profitDashboard } = bundle;
  const today = profitDashboard?.periods.find((p) => p.window === "today");
  const spendToday = snapshot.adSpendSnapshot?.totalRollups.today.spend ?? 0;
  const roasToday =
    spendToday > 0 && today
      ? today.revenue / spendToday
      : profitDashboard?.blendedRoas?.blendedRoas30d ?? 0;

  return {
    syncedAt: snapshot.syncedAt,
    visitorsOnline: snapshot.ga4Snapshot?.sessions30d
      ? Math.round(snapshot.ga4Snapshot.sessions30d / 48)
      : null,
    ordersToday: today?.orders ?? 0,
    revenueToday: today?.revenue ?? 0,
    profitToday: today?.netProfit ?? null,
    spendToday,
    roasToday,
    checkouts: snapshot.ga4Snapshot?.funnelEvents?.checkout30d
      ? Math.max(3, Math.round(snapshot.ga4Snapshot.funnelEvents.checkout30d / 30 / 6))
      : null,
    requiresGa4: !snapshot.ga4Snapshot?.sessions30d,
    aiEvents: [],
  };
}

export function liveDataFingerprint(bundle: StoreBundle): string {
  const s = bundle.snapshot;
  return [
    bundle.storeId,
    s.syncedAt,
    s.storeMetrics.revenue30d,
    s.storeMetrics.orders30d,
    bundle.profitDashboard?.primary.netProfit,
    s.adSpendSnapshot?.totalRollups.today.spend,
  ].join("|");
}
