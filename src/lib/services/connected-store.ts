import { getInstallationForStore } from "@/lib/db/shopify";
import { listMetaAdsInstallationsForStore } from "@/lib/db/meta-ads";
import { aggregateStoreSnapshot, getDataSourceStatuses } from "@/lib/connectors/registry";
import type { StoreSnapshot } from "@/lib/connectors/types";
import { resolveActiveStoreId } from "@/lib/store/context";
import { ALPINE_OUTFITTERS } from "@/lib/demo/alpine-outfitters/constants";
import { isShopifyOAuthConfigured } from "@/lib/shopify/oauth";
import { isMetaOAuthConfigured, getMetaDevOverride } from "@/lib/meta/oauth";
import type { MetaCampaignSyncStats } from "@/lib/meta/campaign-stats";
import { emptyCampaignSyncStats, mergeCampaignSyncStats } from "@/lib/meta/campaign-stats";
import type { ShopifySyncStats } from "@/lib/shopify/sync";

export type MetaAdsAccountView = {
  id: string;
  adAccountId: string;
  adAccountName: string | null;
  businessName: string | null;
  lastSyncAt: string | null;
  campaigns: MetaCampaignSyncStats;
};

export type ConnectedStoreView = {
  isDemo: boolean;
  oauthConfigured: boolean;
  metaOAuthConfigured: boolean;
  metaDevOverride: boolean;
  metaConnected: boolean;
  storeId: string;
  shopDomain: string | null;
  shopName: string | null;
  shopifyPlan: string | null;
  lastSyncAt: string | null;
  connectionHealth: string;
  errorMessage: string | null;
  stats: ShopifySyncStats;
  metaAdsAccounts: MetaAdsAccountView[];
  metaCampaignTotals: MetaCampaignSyncStats;
  dataSources: Awaited<ReturnType<typeof getDataSourceStatuses>>;
};

const EMPTY_STATS: ShopifySyncStats = {
  productCount: 0,
  inventoryCount: 0,
  orderCount: 0,
  customerCount: 0,
  collectionCount: 0,
  discountCount: 0,
};

export async function getConnectedStoreView(): Promise<ConnectedStoreView> {
  const storeId = await resolveActiveStoreId();
  const installation = await getInstallationForStore(storeId);

  let snapshot: StoreSnapshot | null = null;
  try {
    snapshot = await aggregateStoreSnapshot(storeId);
  } catch {
    // non-fatal
  }

  const dataSources = await getDataSourceStatuses(storeId);
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
    metaAdsAccounts.map((account) => account.campaigns),
  );

  if (!installation) {
    return {
      isDemo: true,
      oauthConfigured: isShopifyOAuthConfigured(),
      metaOAuthConfigured: isMetaOAuthConfigured(),
      metaDevOverride: getMetaDevOverride() !== null,
      metaConnected: metaAdsAccounts.length > 0,
      storeId,
      shopDomain: null,
      shopName: `${ALPINE_OUTFITTERS.name} (Demo)`,
      shopifyPlan: ALPINE_OUTFITTERS.plan,
      lastSyncAt: dataSources.find((d) => d.id === "shopify")?.lastSyncAt ?? null,
      connectionHealth: "demo",
      errorMessage: null,
      stats: {
        productCount: snapshot?.products.length ?? 18,
        inventoryCount:
          snapshot?.products.reduce((s, p) => s + p.inventoryQuantity, 0) ?? 0,
        orderCount: snapshot?.storeMetrics.orders30d ?? ALPINE_OUTFITTERS.orders30d,
        customerCount: ALPINE_OUTFITTERS.customerCount,
        collectionCount: snapshot?.collections.length ?? 6,
        discountCount: 8,
      },
      metaAdsAccounts,
      metaCampaignTotals,
      dataSources,
    };
  }

  const refreshed = await getInstallationForStore(storeId);

  return {
    isDemo: false,
    oauthConfigured: isShopifyOAuthConfigured(),
    metaOAuthConfigured: isMetaOAuthConfigured(),
    metaDevOverride: getMetaDevOverride() !== null,
    metaConnected: metaAdsAccounts.length > 0,
    storeId,
    shopDomain: refreshed?.shop_domain ?? installation.shop_domain,
    shopName: refreshed?.shop_name ?? installation.shop_name,
    shopifyPlan: refreshed?.shopify_plan ?? installation.shopify_plan,
    lastSyncAt: refreshed?.last_sync_at ?? installation.last_sync_at,
    connectionHealth: refreshed?.connection_health ?? installation.connection_health,
    errorMessage: refreshed?.error_message ?? installation.error_message,
    stats: refreshed?.sync_stats ?? installation.sync_stats ?? EMPTY_STATS,
    metaAdsAccounts,
    metaCampaignTotals,
    dataSources,
  };
}
