import { listGoogleAdsInstallationsForStore } from "@/lib/db/google-ads";
import {
  resolveGoogleAdsConnectionPresentation,
  resolveGoogleAdsHealthSyncFailed,
} from "@/lib/connections/google-ads-status";
import { listMetaAdsInstallationsForStore } from "@/lib/db/meta-ads";
import { getInstallationForStore } from "@/lib/db/shopify";
import type { StoreSnapshot } from "@/lib/connectors/types";
import { isIntegrationConfigured } from "@/lib/integrations/credentials";
import { PHASE6_INTEGRATIONS } from "@/lib/integrations/types";
import type { DataSourceStatus } from "@/lib/types";

export type IntegrationHealthStatus =
  | "connected"
  | "disconnected"
  | "error"
  | "waiting"
  | "demo";

export type IntegrationHealthCard = {
  id: string;
  label: string;
  status: IntegrationHealthStatus;
  dataMode: "live" | "demo" | "unavailable";
  lastSyncAt: string | null;
  lastSuccessfulSyncAt: string | null;
  syncFailed: boolean;
  errorMessage: string | null;
  metrics: { label: string; value: string }[];
  connectHref?: string;
  syncEndpoint?: string;
};

function formatCurrency(n: number): string {
  return n.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function relativeMinutes(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function mapConnectorStatus(
  status: DataSourceStatus["status"] | undefined,
  syncFailed: boolean,
): IntegrationHealthStatus {
  if (syncFailed || status === "error") return "error";
  if (status === "connected") return "connected";
  if (status === "demo") return "demo";
  return "disconnected";
}

function phase6Def(id: string) {
  return PHASE6_INTEGRATIONS.find((p) => p.id === id);
}

export async function buildIntegrationHealth(
  snapshot: StoreSnapshot,
  dataSources: DataSourceStatus[],
  storeId: string,
): Promise<IntegrationHealthCard[]> {
  const shopifyInstall = await getInstallationForStore(storeId);
  const googleInstalls = await listGoogleAdsInstallationsForStore(storeId);
  const metaInstalls = await listMetaAdsInstallationsForStore(storeId);

  const byId = new Map(dataSources.map((d) => [d.id, d]));
  const cards: IntegrationHealthCard[] = [];

  const shopifySource = byId.get("shopify");
  const shopifyFailed = shopifySource?.status === "error";
  cards.push({
    id: "shopify",
    label: "Shopify",
    status: shopifyInstall
      ? mapConnectorStatus(shopifySource?.status, shopifyFailed)
      : "disconnected",
    dataMode: shopifyInstall ? "live" : snapshot.connectorStates?.shopify === "demo" ? "demo" : "unavailable",
    lastSyncAt: shopifySource?.lastSyncAt ?? snapshot.syncedAt ?? null,
    lastSuccessfulSyncAt: shopifyFailed ? null : shopifySource?.lastSyncAt ?? snapshot.syncedAt ?? null,
    syncFailed: shopifyFailed,
    errorMessage: shopifySource?.errorMessage ?? null,
    metrics: [
      { label: "Products", value: String(snapshot.products.length) },
      { label: "Orders (30d)", value: String(snapshot.storeMetrics.orders30d) },
      {
        label: "Revenue (30d)",
        value: formatCurrency(snapshot.storeMetrics.revenue30d),
      },
    ],
    connectHref: "/connected-store",
  });

  const googleErrored = googleInstalls.find(
    (i) => i.connection_health === "error" && i.error_message?.trim(),
  );
  const googleSource = byId.get("google_ads");
  const googleConnected = googleInstalls.length > 0 || Boolean(snapshot.googleAdsSnapshot);
  const googleLastSync =
    googleInstalls.map((i) => i.last_sync_at).filter(Boolean).sort().pop() ??
    googleSource?.lastSyncAt ??
    null;
  const googleFailed = resolveGoogleAdsHealthSyncFailed({
    installations: googleInstalls,
    connectorSource: googleSource,
  });
  const googleRollups = snapshot.googleAdsSnapshot?.rollups;

  cards.push({
    id: "google_ads",
    label: "Google Ads",
    status: googleConnected
      ? mapConnectorStatus(googleSource?.status ?? "connected", googleFailed)
      : phase6Def("google_ads") && isIntegrationConfigured(phase6Def("google_ads")!)
        ? "waiting"
        : "disconnected",
    dataMode: googleConnected ? "live" : "unavailable",
    lastSyncAt: googleLastSync,
    lastSuccessfulSyncAt: googleFailed ? googleInstalls.find((i) => i.last_sync_at)?.last_sync_at ?? null : googleLastSync,
    syncFailed: googleFailed,
    errorMessage: googleErrored?.error_message ?? googleSource?.errorMessage ?? null,
    metrics: [
      {
        label: "Campaigns",
        value: String(snapshot.googleAdsSnapshot?.campaigns.length ?? 0),
      },
      {
        label: "Today's Spend",
        value: googleRollups ? formatCurrency(googleRollups.today.spend) : "—",
      },
      {
        label: "Status",
        value: googleConnected && !googleFailed ? "Live" : googleFailed ? "Sync Failed" : "Not Connected",
      },
    ],
    connectHref: "/connections",
    syncEndpoint: "/api/google/sync",
  });

  const metaErrored = metaInstalls.find((i) => i.connection_health === "error");
  const metaSource = byId.get("meta_ads");
  const metaConnected = metaInstalls.length > 0 || snapshot.campaigns.length > 0;
  const metaLastSync =
    metaInstalls.map((i) => i.last_sync_at).filter(Boolean).sort().pop() ??
    metaSource?.lastSyncAt ??
    null;
  const metaFailed = Boolean(metaErrored) || metaSource?.status === "error";

  cards.push({
    id: "meta_ads",
    label: "Meta Ads",
    status: metaConnected
      ? mapConnectorStatus(metaSource?.status ?? "connected", metaFailed)
      : "disconnected",
    dataMode: metaConnected ? "live" : "unavailable",
    lastSyncAt: metaLastSync,
    lastSuccessfulSyncAt: metaFailed ? metaInstalls.find((i) => i.last_sync_at)?.last_sync_at ?? null : metaLastSync,
    syncFailed: metaFailed,
    errorMessage: metaErrored?.error_message ?? metaSource?.errorMessage ?? null,
    metrics: [
      { label: "Campaigns", value: String(snapshot.campaigns.length) },
      {
        label: "Spend (7d)",
        value: formatCurrency(
          snapshot.campaigns.reduce((s, c) => s + c.spend7d, 0),
        ),
      },
      {
        label: "Status",
        value: metaConnected && !metaFailed ? "Live" : metaFailed ? "Sync Failed" : "Not Connected",
      },
    ],
    connectHref: "/connections",
    syncEndpoint: "/api/meta/sync",
  });

  const phase6Cards: {
    id: string;
    label: string;
    connected: boolean;
    waiting: boolean;
    preview?: string;
  }[] = [
    {
      id: "ga4",
      label: "GA4",
      connected: Boolean(snapshot.ga4Snapshot),
      waiting: phase6Def("ga4") ? isIntegrationConfigured(phase6Def("ga4")!) : false,
      preview: snapshot.ga4Snapshot
        ? `${snapshot.ga4Snapshot.sessions30d.toLocaleString()} sessions (30d)`
        : undefined,
    },
    {
      id: "tiktok",
      label: "TikTok Ads",
      connected: Boolean(snapshot.tiktokAdsSnapshot),
      waiting: phase6Def("tiktok") ? isIntegrationConfigured(phase6Def("tiktok")!) : false,
      preview: snapshot.tiktokAdsSnapshot
        ? `${snapshot.tiktokAdsSnapshot.campaigns.length} campaigns`
        : undefined,
    },
    {
      id: "klaviyo",
      label: "Klaviyo",
      connected: Boolean(snapshot.klaviyoSnapshot),
      waiting: phase6Def("klaviyo") ? isIntegrationConfigured(phase6Def("klaviyo")!) : false,
      preview: snapshot.klaviyoSnapshot
        ? formatCurrency(snapshot.klaviyoSnapshot.emailAttributedRevenue30d)
        : undefined,
    },
    {
      id: "merchant_center",
      label: "Merchant Center",
      connected: false,
      waiting: false,
    },
  ];

  for (const p of phase6Cards) {
    let status: IntegrationHealthStatus = "disconnected";
    if (p.connected) status = "connected";
    else if (p.waiting) status = "waiting";

    cards.push({
      id: p.id,
      label: p.label,
      status,
      dataMode: p.connected ? "live" : "unavailable",
      lastSyncAt: p.connected ? snapshot.syncedAt : null,
      lastSuccessfulSyncAt: p.connected ? snapshot.syncedAt : null,
      syncFailed: false,
      errorMessage: null,
      metrics: p.preview ? [{ label: "Preview", value: p.preview }] : [],
      connectHref: "/integrations",
    });
  }

  return cards.map((card) => ({
    ...card,
    metrics: [
      ...card.metrics,
      ...(card.lastSyncAt
        ? [{ label: "Last Sync", value: relativeMinutes(card.lastSyncAt) ?? "—" }]
        : []),
    ],
  }));
}
