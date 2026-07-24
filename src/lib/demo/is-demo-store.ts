import type { StoreSnapshot } from "@/lib/connectors/types";
import { allowDemoData } from "@/lib/env/runtime";

/**
 * True only when Demo Mode is enabled AND the snapshot is a synthetic demo store.
 * Always false in production — App Store / live merchants never classify as demo.
 */
export function isDemoStoreSnapshot(snapshot: StoreSnapshot): boolean {
  if (!allowDemoData()) return false;
  return snapshot.source === "demo" || snapshot.connectorStates?.shopify === "demo";
}
