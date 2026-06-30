import type { StoreSnapshot } from "@/lib/connectors/types";
import type { ScenarioParams } from "@/lib/simulation-lab/types";
import { generateSimulationSnapshot } from "@/lib/simulation-lab/generator";

export type ReplayDaySnapshot = {
  day: number;
  date: string;
  snapshot: StoreSnapshot;
};

/** Generate N days of drifting business snapshots from a base scenario */
export function buildReplaySnapshots(input: {
  storeId: string;
  baseParams: ScenarioParams;
  days: number;
  driftPctPerDay?: number;
}): ReplayDaySnapshot[] {
  const drift = input.driftPctPerDay ?? 0.012;
  const result: ReplayDaySnapshot[] = [];
  const start = Date.now() - input.days * 86400000;

  for (let day = 1; day <= input.days; day++) {
    const factor = 1 + drift * (day - input.days / 2);
    const params: ScenarioParams = {
      ...input.baseParams,
      revenue30d: Math.round(input.baseParams.revenue30d * factor),
      orders30d: Math.max(1, Math.round(input.baseParams.orders30d * factor)),
      metaSpend7d: Math.round(input.baseParams.metaSpend7d * (1 + drift * day * 0.3)),
      metaRevenue7d: Math.round(input.baseParams.metaRevenue7d * factor),
      googleSpend7d: Math.round(input.baseParams.googleSpend7d * (1 + drift * day * 0.2)),
      googleRevenue7d: Math.round(input.baseParams.googleRevenue7d * factor),
      products: input.baseParams.products.map((p) => ({
        ...p,
        unitsSold30d: Math.max(0, Math.round(p.unitsSold30d * factor)),
        inventory: Math.max(0, Math.round(p.inventory * (2 - factor * 0.5))),
      })),
    };
    const snapshot = generateSimulationSnapshot(input.storeId, params);
    snapshot.syncedAt = new Date(start + (day - 1) * 86400000).toISOString();
    result.push({
      day,
      date: snapshot.syncedAt.slice(0, 10),
      snapshot,
    });
  }
  return result;
}
