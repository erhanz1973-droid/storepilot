import type { StoreSnapshot } from "@/lib/connectors/types";
import { updateShopifySyncResult } from "@/lib/db/shopify";
import { setMetaSyncCache } from "@/lib/db/meta-sync-cache";
import { setGoogleSyncCache } from "@/lib/db/google-sync-cache";
import { bulkUpsertProductCosts } from "@/lib/db/product-costs";
import { syncConnectorStatuses } from "@/lib/db/recommendations";
import { upsertStoreBusinessProfile } from "@/lib/db/business-profile";
import { upsertMerchantDnaProfile } from "@/lib/db/merchant-dna";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import type { ScenarioParams } from "@/lib/simulation-lab/types";
import {
  buildSimulationBusinessProfile,
  buildSimulationMerchantDna,
} from "@/lib/simulation-lab/simulation-profile";
import { computeProfitDashboard } from "@/lib/profit/engine";
import { splitSnapshotForCaches } from "./load";
import { updateSimulationStoreMeta } from "./db";

export async function persistSimulationSnapshot(
  storeId: string,
  snapshot: StoreSnapshot,
  input: {
    scenarioId: string;
    businessModel: import("@/lib/business-model/types").BusinessModel;
    seedParams: Partial<ScenarioParams>;
  },
): Promise<void> {
  const now = new Date().toISOString();
  const { shopify, meta, google } = splitSnapshotForCaches(snapshot);

  const stats: import("@/lib/shopify/sync").ShopifySyncStats = {
    productCount: snapshot.products.length,
    inventoryCount: snapshot.products.reduce((s, p) => s + (p.inventoryQuantity ?? 0), 0),
    orderCount: snapshot.storeMetrics.orders30d,
    customerCount: Math.max(1, Math.round(snapshot.storeMetrics.orders30d * 0.85)),
    collectionCount: snapshot.collections.length,
    discountCount: 0,
  };

  await updateShopifySyncResult(storeId, stats, shopify, {
    shopName: snapshot.commerceStoreDomain?.replace(".simulation.local", "") ?? "Simulation",
  });
  await setMetaSyncCache(storeId, meta);
  await setGoogleSyncCache(storeId, google);

  const costs = input.seedParams.products ?? [];
  if (costs.length > 0) {
    await bulkUpsertProductCosts(
      storeId,
      costs.map((p) => ({ shopifyProductId: p.id, unitCost: p.unitCost })),
      "csv_import",
    );
  }

  const costRecords = costs.map((p) => ({
    shopifyProductId: p.id,
    unitCost: p.unitCost,
    source: "csv_import" as const,
    updatedAt: now,
  }));
  const profitDashboard = computeProfitDashboard(snapshot, costRecords);

  const businessProfile = buildSimulationBusinessProfile(
    storeId,
    input.businessModel,
    snapshot,
    profitDashboard,
  );
  await upsertStoreBusinessProfile(storeId, businessProfile);

  const merchantDna = buildSimulationMerchantDna(
    storeId,
    input.businessModel,
    snapshot,
    profitDashboard,
  );
  await upsertMerchantDnaProfile(storeId, {
    dna: merchantDna,
    learned: merchantDna.learned,
    manualOverrides: merchantDna.manualOverrides ?? {},
    benchmarkCohort: merchantDna.benchmarkCohort ?? `sim_${input.businessModel}`,
    version: merchantDna.version ?? 1,
  });

  await syncConnectorStatuses(storeId, [
    { connector_type: "shopify", label: "Shopify (simulation)", status: "connected", last_sync_at: now },
    { connector_type: "meta_ads", label: "Meta Ads (simulation)", status: "connected", last_sync_at: now },
    { connector_type: "google_ads", label: "Google Ads (simulation)", status: "connected", last_sync_at: now },
  ]);

  await updateSimulationStoreMeta(storeId, {
    generatedAt: now,
    seedParams: input.seedParams,
    scenarioId: input.scenarioId as import("@/lib/simulation-lab/types").SimulationScenarioId,
    businessModel: input.businessModel,
    lastRegeneratedAt: now,
  });
}

/** Remove all persisted data for a simulation store — production stores are rejected. */
export async function clearSimulationStoreData(storeId: string): Promise<void> {
  const { isSimulationStore } = await import("./db");
  if (!(await isSimulationStore(storeId))) {
    throw new Error("Refusing to clear data for a non-simulation store");
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return;

  const tables = [
    "recommendations",
    "recommendation_history",
    "recommendation_validation_audit",
    "recommendation_outcomes",
    "recommendation_feedback",
    "outcome_records",
    "action_executions",
    "daily_snapshots",
    "opportunity_history",
    "product_costs",
    "shopify_sync_cache",
    "meta_sync_cache",
    "google_sync_cache",
    "decision_quality_scores",
    "decision_intent_evaluations",
  ] as const;

  await Promise.all(
    tables.map((table) => supabase.from(table).delete().eq("store_id", storeId)),
  );

  await updateSimulationStoreMeta(storeId, { seedParams: {} });
}
