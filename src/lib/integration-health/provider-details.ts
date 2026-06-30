import { getInstallationForStore } from "@/lib/db/shopify";
import { listGoogleAdsInstallationsForStore } from "@/lib/db/google-ads";
import { listMetaAdsInstallationsForStore } from "@/lib/db/meta-ads";
import { listGa4Installations } from "@/lib/db/ga4";
import type { IntegrationHealthCard } from "@/lib/integrations/health";
import type { StoreSnapshot } from "@/lib/connectors/types";
import type { ProviderValidationState } from "@/lib/recommendations/validation/types";
import type { EntityCheck, ProviderHealthDetail } from "./types";
import { dataQualityScore, runDataQualityChecks } from "./data-quality";

function freshnessFromMinutes(mins: number | null): "fresh" | "stale" | "unknown" {
  if (mins == null) return "unknown";
  if (mins <= 360) return "fresh";
  return "stale";
}

function aiReadyFromProvider(
  card: IntegrationHealthCard,
  validation: ProviderValidationState | undefined,
  entityScore: number,
): { pct: number; ready: boolean } {
  if (card.status === "disconnected" || card.status === "waiting") {
    return { pct: 0, ready: false };
  }
  if (card.syncFailed || card.status === "error") {
    return { pct: Math.min(40, entityScore), ready: false };
  }
  const validationBoost =
    validation?.readiness === "production_ready"
      ? 100
      : validation?.readiness === "development"
        ? 75
        : validation?.connected
          ? 55
          : 30;
  const pct = Math.round(entityScore * 0.5 + validationBoost * 0.5);
  return { pct, ready: pct >= 80 };
}

function shopifyEntities(
  snapshot: StoreSnapshot,
  syncStats?: { productCount: number; orderCount: number; customerCount: number; inventoryCount: number; collectionCount: number; discountCount: number },
): EntityCheck[] {
  const products = snapshot.products.length;
  const withInventory = snapshot.products.filter((p) => p.inventoryQuantity >= 0).length;
  const orders = syncStats?.orderCount ?? snapshot.storeMetrics.orders30d;
  const customers =
    syncStats?.customerCount ??
    snapshot.customerSnapshot?.customers.length ??
    0;
  const collections = syncStats?.collectionCount ?? snapshot.collections.length;

  return [
    { label: "Products", value: String(products), status: products > 0 ? "synced" : "missing" },
    { label: "Orders", value: String(orders), status: orders > 0 ? "synced" : "missing" },
    { label: "Customers", value: String(customers), status: customers > 0 ? "synced" : "missing" },
    {
      label: "Inventory",
      value: products > 0 ? `${withInventory}/${products} synced` : "—",
      status: products > 0 && withInventory === products ? "synced" : products > 0 ? "partial" : "missing",
    },
    { label: "Collections", value: String(collections), status: collections > 0 ? "synced" : "partial" },
    {
      label: "Refunds",
      value: snapshot.profitRollups?.last30d.refunds ? "Synced" : "Estimated",
      status: snapshot.profitRollups ? "synced" : "partial",
    },
  ];
}

function metaEntities(snapshot: StoreSnapshot): EntityCheck[] {
  const camps = snapshot.campaigns;
  const spend = camps.reduce((s, c) => s + c.spend7d, 0);
  const hasPurchases = camps.some((c) => c.revenue7d > 0);
  const hasRoas = camps.some((c) => c.roas7d > 0);
  const hasAttribution = Boolean(snapshot.adSpendSnapshot?.platforms.find((p) => p.platform === "meta_ads"));

  return [
    { label: "Campaigns", value: String(camps.length), status: camps.length > 0 ? "synced" : "missing" },
    { label: "Spend", value: spend > 0 ? "Synced" : "—", status: spend > 0 ? "synced" : "missing" },
    { label: "Purchases", value: hasPurchases ? "Synced" : "—", status: hasPurchases ? "synced" : "partial" },
    { label: "ROAS", value: hasRoas ? "Synced" : "—", status: hasRoas ? "synced" : "partial" },
    {
      label: "Attribution",
      value: hasAttribution ? "Synced" : "Partial",
      status: hasAttribution ? "synced" : "partial",
    },
    {
      label: "Daily Spend",
      value: snapshot.metaDailySpend?.length ? "Synced" : "—",
      status: snapshot.metaDailySpend?.length ? "synced" : "partial",
    },
  ];
}

function googleEntities(snapshot: StoreSnapshot): EntityCheck[] {
  const g = snapshot.googleAdsSnapshot;
  if (!g) {
    return [
      { label: "Campaigns", value: "—", status: "missing" },
      { label: "Conversions", value: "—", status: "missing" },
    ];
  }
  const shopping = g.campaigns.filter((c) => c.type === "shopping").length;
  const search = g.campaigns.filter((c) => c.type === "search").length;
  const pmax = g.campaigns.filter((c) => /performance|pmax/i.test(c.name)).length;
  const conv = g.campaigns.reduce((s, c) => s + c.conversions7d, 0);

  return [
    { label: "Campaigns", value: String(g.campaigns.length), status: "synced" },
    { label: "Shopping", value: String(shopping), status: shopping > 0 ? "synced" : "partial" },
    { label: "Search", value: String(search), status: search > 0 ? "synced" : "partial" },
    { label: "Performance Max", value: String(pmax), status: pmax > 0 ? "synced" : "unknown" },
    { label: "Conversions", value: String(conv), status: conv > 0 ? "synced" : "partial" },
    {
      label: "Revenue",
      value: g.rollups.last7d.attributedRevenue > 0 ? "Synced" : "—",
      status: g.rollups.last7d.attributedRevenue > 0 ? "synced" : "partial",
    },
  ];
}

function ga4Entities(snapshot: StoreSnapshot): EntityCheck[] {
  const ga = snapshot.ga4Snapshot;
  if (!ga) {
    return [{ label: "Sessions", value: "—", status: "missing" }];
  }
  const purchaseEvents =
    ga.funnelEvents?.purchases30d ?? ga.purchases30d ?? 0;
  const hasEcom = ga.ecommerceConversionRatePct != null || purchaseEvents > 0;

  return [
    { label: "Sessions", value: ga.sessions30d.toLocaleString(), status: "synced" },
    { label: "Users", value: ga.users30d?.toLocaleString() ?? "—", status: ga.users30d ? "synced" : "partial" },
    {
      label: "Revenue",
      value: ga.purchaseRevenue30d != null ? "Synced" : "—",
      status: ga.purchaseRevenue30d != null ? "synced" : "partial",
    },
    {
      label: "Ecommerce Events",
      value: hasEcom ? "Synced" : "Missing",
      status: hasEcom ? "synced" : "missing",
    },
    {
      label: "Conversion Rate",
      value: ga.ecommerceConversionRatePct != null ? `${ga.ecommerceConversionRatePct.toFixed(2)}%` : "—",
      status: ga.ecommerceConversionRatePct != null ? "synced" : "missing",
    },
    {
      label: "Landing Pages",
      value: ga.landingPages?.length ? String(ga.landingPages.length) : "—",
      status: ga.landingPages?.length ? "synced" : "partial",
    },
  ];
}

function entityScore(checks: EntityCheck[]): number {
  if (checks.length === 0) return 0;
  const weights = { synced: 100, partial: 60, unknown: 40, missing: 0 };
  const sum = checks.reduce((s, c) => s + weights[c.status], 0);
  return Math.round(sum / checks.length);
}

export async function buildProviderHealthDetails(input: {
  cards: IntegrationHealthCard[];
  snapshot: StoreSnapshot;
  validationProviders: ProviderValidationState[];
  storeId: string;
  profitDashboard: import("@/lib/profit/types").ProfitDashboard | null;
}): Promise<ProviderHealthDetail[]> {
  const { cards, snapshot, validationProviders, storeId, profitDashboard } = input;
  const shopifyInstall = await getInstallationForStore(storeId);
  const metaInstalls = await listMetaAdsInstallationsForStore(storeId);
  const googleInstalls = await listGoogleAdsInstallationsForStore(storeId);
  const ga4Installs = await listGa4Installations(storeId);
  const qualityIssues = runDataQualityChecks(snapshot, profitDashboard);
  const shopifyQuality = dataQualityScore(qualityIssues.filter((i) => i.source === "shopify" || i.source === "system"));

  const validationByConnector = new Map(validationProviders.map((p) => [p.connectorId, p]));

  return cards.map((card) => {
    const connectorId =
      card.id === "meta_ads"
        ? "meta_ads"
        : card.id === "google_ads"
          ? "google_ads"
          : card.id === "ga4"
            ? "ga4"
            : card.id;
    const validation = validationByConnector.get(connectorId as never);

    let entityChecks: EntityCheck[] = [];
    if (card.id === "shopify") {
      entityChecks = shopifyEntities(snapshot, shopifyInstall?.sync_stats);
    } else if (card.id === "meta_ads") {
      entityChecks = metaEntities(snapshot);
    } else if (card.id === "google_ads") {
      entityChecks = googleEntities(snapshot);
    } else if (card.id === "ga4") {
      entityChecks = ga4Entities(snapshot);
    } else {
      entityChecks = card.metrics.map((m) => ({
        label: m.label,
        value: m.value,
        status: card.status === "connected" ? ("synced" as const) : ("missing" as const),
      }));
    }

    const entScore = entityScore(entityChecks);
    const { pct, ready } = aiReadyFromProvider(card, validation, entScore);

    const installs =
      card.id === "meta_ads"
        ? metaInstalls
        : card.id === "google_ads"
          ? googleInstalls
          : card.id === "ga4"
            ? ga4Installs
            : [];

    const tokenValid =
      card.id === "shopify"
        ? shopifyInstall?.status === "active"
        : installs.length > 0 && !installs.some((i) => "connection_health" in i && i.connection_health === "error");

    const dataAgeMin = validation?.dataAgeMinutes ?? null;

    return {
      id: card.id,
      label: card.label,
      connectionStatus: card.status,
      tokenValid: Boolean(tokenValid),
      lastSuccessfulSync: card.lastSuccessfulSyncAt ?? card.lastSyncAt,
      apiLatencyMs: null,
      rateLimitStatus: card.syncFailed ? "warning" : "ok",
      lastApiError: card.errorMessage,
      recordsSynced:
        card.id === "shopify"
          ? snapshot.products.length
          : card.id === "meta_ads"
            ? snapshot.campaigns.length
            : card.id === "google_ads"
              ? (snapshot.googleAdsSnapshot?.campaigns.length ?? 0)
              : null,
      missingFields: entityChecks.filter((e) => e.status === "missing").map((e) => e.label),
      dataFreshness: freshnessFromMinutes(dataAgeMin),
      dataQualityPct: card.id === "shopify" ? shopifyQuality : entScore,
      aiReadyPct: pct,
      aiReady: ready,
      entityChecks,
      connectHref: card.connectHref,
      syncEndpoint: card.syncEndpoint,
    };
  });
}
