import type { StoreSnapshot } from "@/lib/connectors/types";

export function isDemoStoreSnapshot(snapshot: StoreSnapshot): boolean {
  return snapshot.source === "demo" || snapshot.connectorStates?.shopify === "demo";
}
