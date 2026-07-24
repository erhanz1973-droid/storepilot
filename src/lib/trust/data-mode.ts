import type { StoreSnapshot } from "@/lib/connectors/types";
import { isDemoStoreSnapshot } from "@/lib/demo/is-demo-store";
import { allowDemoData } from "@/lib/env/runtime";
import { isSimulationStoreId } from "@/lib/simulation-lab/store-ids";
import { DEMO_STORE_ID } from "@/lib/types";

export type DataMode = "live" | "demo" | "simulation";

export function resolveDataMode(storeId: string, snapshot: StoreSnapshot): DataMode {
  if (isSimulationStoreId(storeId)) return "simulation";
  if (allowDemoData() && (isDemoStoreSnapshot(snapshot) || storeId === DEMO_STORE_ID)) {
    return "demo";
  }
  return "live";
}

/** Live merchant context — never inject simulation or placeholder intelligence. */
export function isLiveMerchantContext(storeId: string, snapshot: StoreSnapshot): boolean {
  return resolveDataMode(storeId, snapshot) === "live";
}

/** Synthetic campaigns, attribution journeys, demo integrations, placeholder AI. */
export function mayUseSyntheticData(storeId: string, snapshot: StoreSnapshot): boolean {
  if (isLiveMerchantContext(storeId, snapshot)) return false;
  return allowDemoData();
}

export function dataUnavailableMessage(source: string, reason: string): string {
  return `${source} is unavailable: ${reason}. Connect the integration or wait for sync to complete before relying on recommendations in this area.`;
}
