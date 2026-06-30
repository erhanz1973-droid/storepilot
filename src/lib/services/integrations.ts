import { aggregateStoreSnapshot } from "@/lib/connectors/registry";
import { computeIntegrationConfidence } from "@/lib/integrations/confidence";
import { isIntegrationConfigured } from "@/lib/integrations/credentials";
import { PHASE6_INTEGRATIONS, type IntegrationDefinition } from "@/lib/integrations/types";
import { resolveActiveStoreId } from "@/lib/store/context";

export type IntegrationStatusRow = IntegrationDefinition & {
  configured: boolean;
  connected: boolean;
  dataPreview?: string;
};

export type IntegrationsHub = {
  syncedAt: string;
  confidence: ReturnType<typeof computeIntegrationConfidence>;
  integrations: IntegrationStatusRow[];
  operationalCosts: {
    shippingCost30d: number;
    supportCost30d: number;
    warehouseCost30d: number;
    actualCogs30d: number | null;
    sources: string[];
  } | null;
};

function isConnected(
  id: string,
  snapshot: Awaited<ReturnType<typeof aggregateStoreSnapshot>>,
): boolean {
  switch (id) {
    case "google_ads":
      return Boolean(snapshot.googleAdsSnapshot);
    case "tiktok":
      return Boolean(snapshot.tiktokAdsSnapshot);
    case "klaviyo":
      return Boolean(snapshot.klaviyoSnapshot);
    case "ga4":
      return Boolean(snapshot.ga4Snapshot);
    case "meta_capi":
      return Boolean(snapshot.metaCapiStatus?.enabled);
    case "inventory":
      return Boolean(snapshot.integrationSnapshot?.inventory?.liveSync);
    case "accounting":
      return Boolean(snapshot.integrationSnapshot?.accounting?.liveSync);
    case "shipping":
      return Boolean(snapshot.integrationSnapshot?.shipping?.liveSync);
    case "support":
      return Boolean(snapshot.integrationSnapshot?.support?.liveSync);
    case "warehouse":
      return Boolean(snapshot.integrationSnapshot?.warehouse?.liveSync);
    default:
      return false;
  }
}

function dataPreview(
  id: string,
  snapshot: Awaited<ReturnType<typeof aggregateStoreSnapshot>>,
): string | undefined {
  switch (id) {
    case "google_ads":
      return snapshot.googleAdsSnapshot
        ? `${snapshot.googleAdsSnapshot.campaigns.length} campaigns · $${snapshot.googleAdsSnapshot.rollups.last30d.spend.toLocaleString()} spend (30d)`
        : undefined;
    case "tiktok":
      return snapshot.tiktokAdsSnapshot
        ? `${snapshot.tiktokAdsSnapshot.campaigns.length} campaigns · $${snapshot.tiktokAdsSnapshot.rollups.last30d.spend.toLocaleString()} spend (30d)`
        : undefined;
    case "klaviyo":
      return snapshot.klaviyoSnapshot
        ? `$${snapshot.klaviyoSnapshot.emailAttributedRevenue30d.toLocaleString()} email revenue (30d)`
        : undefined;
    case "ga4":
      return snapshot.ga4Snapshot
        ? `${snapshot.ga4Snapshot.sessions30d.toLocaleString()} sessions (30d)`
        : undefined;
    case "meta_capi":
      return snapshot.metaCapiStatus?.enabled
        ? `${snapshot.metaCapiStatus.matchRatePct}% match rate · ${snapshot.metaCapiStatus.eventsReceived30d} events (30d)`
        : undefined;
    case "accounting":
      return snapshot.integrationSnapshot?.accounting
        ? `$${snapshot.integrationSnapshot.accounting.actualCogs30d.toLocaleString()} actual COGS (30d)`
        : undefined;
    case "shipping":
      return snapshot.integrationSnapshot?.shipping
        ? `$${snapshot.integrationSnapshot.shipping.shippingCost30d.toLocaleString()} shipping (30d)`
        : undefined;
    default:
      return undefined;
  }
}

export async function buildIntegrationsHub(): Promise<IntegrationsHub> {
  const storeId = await resolveActiveStoreId();
  const snapshot = await aggregateStoreSnapshot(storeId);
  const integration = snapshot.integrationSnapshot;

  const integrations: IntegrationStatusRow[] = PHASE6_INTEGRATIONS.map((def) => ({
    ...def,
    configured: isIntegrationConfigured(def),
    connected: isConnected(def.id, snapshot),
    dataPreview: dataPreview(def.id, snapshot),
  }));

  return {
    syncedAt: snapshot.syncedAt,
    confidence: computeIntegrationConfidence(snapshot, integration),
    integrations,
    operationalCosts: snapshot.operationalCosts ?? null,
  };
}
