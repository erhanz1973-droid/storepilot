import { listGoogleAdsInstallationsForStore } from "@/lib/db/google-ads";
import {
  emptyGoogleCampaignSyncStats,
  mergeGoogleCampaignSyncStats,
  type GoogleCampaignSyncStats,
} from "@/lib/google-ads/campaign-stats";
import {
  getGoogleAdsDevOverride,
  isGoogleAdsOAuthConfigured,
} from "@/lib/google-ads/oauth";
import { aggregateStoreSnapshot, getDataSourceStatuses } from "@/lib/connectors/registry";
import { getInstallationForStore } from "@/lib/db/shopify";
import { isShopifyOAuthConfigured } from "@/lib/shopify/oauth";
import { isMetaOAuthConfigured, getMetaDevOverride } from "@/lib/meta/oauth";
import { listMetaAdsInstallationsForStore } from "@/lib/db/meta-ads";
import { emptyCampaignSyncStats, mergeCampaignSyncStats } from "@/lib/meta/campaign-stats";
import type { MetaCampaignSyncStats } from "@/lib/meta/campaign-stats";
import { buildIntegrationHealth } from "@/lib/integrations/health";
import { getConnectionsByCategory } from "@/lib/connections/catalog";
import { resolveActiveCommerceProvider } from "@/lib/commerce/providers/registry";
import { shopifyCommerceProvider } from "@/lib/commerce/providers/shopify";
import type { CommercePlatformId } from "@/lib/commerce/types";
import { resolveActiveStoreId } from "@/lib/store/context";

export type GoogleAdsAccountView = {
  id: string;
  customerId: string;
  customerName: string | null;
  lastSyncAt: string | null;
  campaigns: GoogleCampaignSyncStats;
};

export type MetaAdsAccountView = {
  id: string;
  adAccountId: string;
  adAccountName: string | null;
  businessName: string | null;
  lastSyncAt: string | null;
  campaigns: MetaCampaignSyncStats;
};

export type ConnectionsView = {
  storeId: string;
  isDemo: boolean;
  googleOAuthConfigured: boolean;
  googleDevOverride: boolean;
  googleConnected: boolean;
  googleAdsAccounts: GoogleAdsAccountView[];
  googleCampaignTotals: GoogleCampaignSyncStats;
  metaOAuthConfigured: boolean;
  metaDevOverride: boolean;
  metaConnected: boolean;
  metaAdsAccounts: MetaAdsAccountView[];
  metaCampaignTotals: MetaCampaignSyncStats;
  shopifyConnected: boolean;
  shopDomain: string | null;
  /** Provider-neutral commerce connection state */
  commerceConnected: boolean;
  commerceProvider: CommercePlatformId | null;
  commerceDomain: string | null;
  dataSources: Awaited<ReturnType<typeof getDataSourceStatuses>>;
};

export async function getConnectionsView(): Promise<ConnectionsView> {
  const storeId = await resolveActiveStoreId();
  const installation = await getInstallationForStore(storeId);

  const googleInstallations = await listGoogleAdsInstallationsForStore(storeId);
  const googleAdsAccounts = googleInstallations.map((i) => ({
    id: i.id,
    customerId: i.customer_id,
    customerName: i.customer_name,
    lastSyncAt: i.last_sync_at,
    campaigns: i.sync_stats ?? emptyGoogleCampaignSyncStats(),
  }));
  const googleCampaignTotals = mergeGoogleCampaignSyncStats(
    googleAdsAccounts.map((a) => a.campaigns),
  );

  const metaInstallations = await listMetaAdsInstallationsForStore(storeId);
  const metaAdsAccounts = metaInstallations.map((i) => ({
    id: i.id,
    adAccountId: i.ad_account_id,
    adAccountName: i.ad_account_name,
    businessName: i.business_name,
    lastSyncAt: i.last_sync_at,
    campaigns: i.sync_stats ?? emptyCampaignSyncStats(),
  }));
  const metaCampaignTotals = mergeCampaignSyncStats(
    metaAdsAccounts.map((a) => a.campaigns),
  );

  const dataSources = await getDataSourceStatuses(storeId);
  const commerceProviderAdapter =
    (await resolveActiveCommerceProvider(storeId)) ?? shopifyCommerceProvider;
  const commerceStatus = await commerceProviderAdapter.getStatus(storeId);

  return {
    storeId,
    isDemo: !installation,
    googleOAuthConfigured: isGoogleAdsOAuthConfigured(),
    googleDevOverride: getGoogleAdsDevOverride() !== null,
    googleConnected: googleAdsAccounts.length > 0 || getGoogleAdsDevOverride() !== null,
    googleAdsAccounts,
    googleCampaignTotals,
    metaOAuthConfigured: isMetaOAuthConfigured(),
    metaDevOverride: getMetaDevOverride() !== null,
    metaConnected: metaAdsAccounts.length > 0,
    metaAdsAccounts,
    metaCampaignTotals,
    shopifyConnected: Boolean(installation),
    shopDomain: installation?.shop_domain ?? null,
    commerceConnected: commerceStatus.status === "connected",
    commerceProvider: commerceProviderAdapter.platform,
    commerceDomain: commerceStatus.storeDomain ?? installation?.shop_domain ?? null,
    dataSources,
  };
}

export function getConnectionCatalogGrouped() {
  return getConnectionsByCategory();
}

/** Trigger snapshot aggregation to refresh blended ROAS after connect */
export async function warmConnectionsSnapshot(): Promise<void> {
  const storeId = await resolveActiveStoreId();
  try {
    await aggregateStoreSnapshot(storeId);
  } catch {
    // non-fatal
  }
}

export async function getIntegrationHealthCards() {
  const storeId = await resolveActiveStoreId();
  const [snapshot, dataSources] = await Promise.all([
    aggregateStoreSnapshot(storeId),
    getDataSourceStatuses(storeId),
  ]);
  return buildIntegrationHealth(snapshot, dataSources, storeId);
}
