import { getCachedShopifySnapshot } from "@/lib/db/shopify";
import { getMetaSyncCache } from "@/lib/db/meta-sync-cache";
import { getGoogleSyncCache } from "@/lib/db/google-sync-cache";
import { listProductCosts } from "@/lib/db/product-costs";
import { getSimulationStoreById } from "./db";
import type { SimulationStoreExport } from "./types";

export async function exportSimulationStore(storeId: string): Promise<SimulationStoreExport> {
  const store = await getSimulationStoreById(storeId);
  if (!store) throw new Error("Simulation store not found");

  const [shopifyCache, metaCache, googleCache, productCosts] = await Promise.all([
    getCachedShopifySnapshot(storeId),
    getMetaSyncCache(storeId),
    getGoogleSyncCache(storeId),
    listProductCosts(storeId),
  ]);

  return {
    store,
    exportedAt: new Date().toISOString(),
    shopifyCache,
    metaCache,
    googleCache,
    productCosts,
  };
}
