import { cache } from "react";
import { aggregateStoreSnapshot } from "@/lib/connectors/registry";
import { listProductCosts } from "@/lib/db/product-costs";
import type { ProductCostRecord } from "@/lib/db/product-costs";
import { computeProfitDashboard } from "@/lib/profit/engine";
import type { ProfitDashboard } from "@/lib/profit/types";
import type { StoreSnapshot } from "@/lib/connectors/types";
import { resolveActiveStoreId } from "@/lib/store/context";

/** Request-scoped store id — deduped within a single RSC render. */
export const getCachedActiveStoreId = cache(async (): Promise<string> => {
  return resolveActiveStoreId();
});

/** Request-scoped connector snapshot — one aggregation per page load. */
export const getCachedSnapshot = cache(async (storeId: string): Promise<StoreSnapshot> => {
  return aggregateStoreSnapshot(storeId);
});

export const getCachedProductCosts = cache(
  async (storeId: string): Promise<ProductCostRecord[]> => {
    return listProductCosts(storeId);
  },
);

export const getCachedProfitDashboard = cache(
  async (storeId: string): Promise<ProfitDashboard | null> => {
    const snapshot = await getCachedSnapshot(storeId);
    const costRecords = await getCachedProductCosts(storeId);
    return computeProfitDashboard(snapshot, costRecords);
  },
);

export type StoreBundle = {
  storeId: string;
  snapshot: StoreSnapshot;
  costRecords: ProductCostRecord[];
  profitDashboard: ProfitDashboard | null;
};

/** Snapshot + costs + profit computed once per request. */
export const getCachedStoreBundle = cache(async (): Promise<StoreBundle> => {
  const storeId = await getCachedActiveStoreId();
  const [snapshot, costRecords] = await Promise.all([
    getCachedSnapshot(storeId),
    getCachedProductCosts(storeId),
  ]);
  const profitDashboard = computeProfitDashboard(snapshot, costRecords);
  return { storeId, snapshot, costRecords, profitDashboard };
});
