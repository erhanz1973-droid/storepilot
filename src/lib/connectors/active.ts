import type { ConnectorStatus, DataSourceId } from "@/lib/types";
import { allowDemoData } from "@/lib/env/runtime";

/** Only connected (or Shopify demo in dev) sources may feed analyzers */
export function isConnectorActiveForAnalysis(
  id: DataSourceId,
  status: ConnectorStatus,
): boolean {
  if (status === "connected") return true;
  if (status === "demo" && allowDemoData()) {
    return id === "shopify" || id === "meta_ads";
  }
  return false;
}

export function getActiveConnectors(
  states: Partial<Record<DataSourceId, ConnectorStatus>>,
): DataSourceId[] {
  return (Object.keys(states) as DataSourceId[]).filter((id) =>
    isConnectorActiveForAnalysis(id, states[id] ?? "disconnected"),
  );
}

const AD_CONNECTOR_IDS: DataSourceId[] = ["meta_ads", "google_ads", "tiktok"];

export function hasActiveAdsConnector(
  states: Partial<Record<DataSourceId, ConnectorStatus>>,
): boolean {
  return AD_CONNECTOR_IDS.some((id) =>
    isConnectorActiveForAnalysis(id, states[id] ?? "disconnected"),
  );
}
