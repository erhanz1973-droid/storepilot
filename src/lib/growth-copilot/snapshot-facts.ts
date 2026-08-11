import { hasActiveAdsConnector } from "@/lib/connectors/active";
import type { StoreSnapshot } from "@/lib/connectors/types";
import type { ProfitDashboard } from "@/lib/profit/types";
import type { ConnectorStatus, DataSourceId } from "@/lib/types";
import { SHORT_DESCRIPTION_CHARS, SHORT_TITLE_CHARS } from "./thresholds";

export function connectorIsLinked(
  snapshot: StoreSnapshot,
  id: DataSourceId,
): boolean {
  const status: ConnectorStatus | undefined = snapshot.connectorStates?.[id];
  return status === "connected" || status === "demo";
}

export function metaAdsLinked(snapshot: StoreSnapshot): boolean {
  return connectorIsLinked(snapshot, "meta_ads") || (snapshot.campaigns?.length ?? 0) > 0;
}

export function googleAdsLinked(snapshot: StoreSnapshot): boolean {
  return (
    connectorIsLinked(snapshot, "google_ads") || Boolean(snapshot.googleAdsSnapshot)
  );
}

export function ga4Linked(snapshot: StoreSnapshot): boolean {
  return connectorIsLinked(snapshot, "ga4") || Boolean(snapshot.ga4Snapshot);
}

export function adsSpend7d(snapshot: StoreSnapshot): number {
  const meta = (snapshot.campaigns ?? []).reduce((sum, c) => sum + (c.spend7d ?? 0), 0);
  const google = snapshot.googleAdsSnapshot?.rollups?.last7d?.spend ?? 0;
  const tiktok =
    snapshot.tiktokAdsSnapshot?.campaigns?.reduce((sum, c) => sum + (c.spend7d ?? 0), 0) ?? 0;
  const rolled = snapshot.adSpendSnapshot?.totalRollups?.last7d?.spend ?? 0;
  return Math.max(meta + google + tiktok, rolled);
}

export function hasMeaningfulAdsData(snapshot: StoreSnapshot): boolean {
  if (!hasActiveAdsConnector(snapshot.connectorStates ?? {}) && adsSpend7d(snapshot) <= 0) {
    return false;
  }
  return adsSpend7d(snapshot) > 0;
}

export function countAcquisitionChannels(snapshot: StoreSnapshot): number {
  let count = 0;
  if (metaAdsLinked(snapshot) && ((snapshot.campaigns ?? []).some((c) => (c.spend7d ?? 0) > 0) || connectorIsLinked(snapshot, "meta_ads"))) {
    count += 1;
  }
  if (googleAdsLinked(snapshot)) count += 1;
  if (connectorIsLinked(snapshot, "tiktok") || (snapshot.tiktokAdsSnapshot?.campaigns?.length ?? 0) > 0) {
    count += 1;
  }
  if (ga4Linked(snapshot) && (snapshot.ga4Snapshot?.sessions30d ?? 0) > 0) count += 1;
  return count;
}

export function orderCount(snapshot: StoreSnapshot): number {
  const fromOrders = snapshot.commerceOrders?.length;
  if (fromOrders != null && fromOrders > 0) return fromOrders;
  return snapshot.storeMetrics?.orders30d ?? 0;
}

export function revenueAmount(snapshot: StoreSnapshot): number {
  const fromOrders = (snapshot.commerceOrders ?? []).reduce((sum, o) => sum + (o.revenue ?? 0), 0);
  if (fromOrders > 0) return fromOrders;
  return snapshot.storeMetrics?.revenue30d ?? 0;
}

export function shopAgeDays(snapshot: StoreSnapshot, now = new Date()): number | null {
  const created = snapshot.shopProfile?.createdAt;
  if (!created) return null;
  const ms = now.getTime() - new Date(created).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  return Math.floor(ms / 86_400_000);
}

export function formatUsd(amount: number): string {
  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

export function descriptionsWereSynced(snapshot: StoreSnapshot): boolean {
  return snapshot.products.some(
    (p) => typeof p.descriptionLength === "number" || typeof p.description === "string",
  );
}

export function policiesWereSynced(snapshot: StoreSnapshot): boolean {
  return Boolean(snapshot.shopProfile?.policies);
}

function titleLooksIncomplete(title: string): boolean {
  const trimmed = title.trim();
  if (trimmed.length < SHORT_TITLE_CHARS) return true;
  return /^(untitled|product|item|new product)$/i.test(trimmed);
}

export type ProductQualityCounts = {
  total: number;
  missingTitle: number;
  missingPrice: number;
  missingImage: number;
  shortDescription: number;
  missingDescription: number;
  descriptionsKnown: boolean;
  zeroInventoryTracked: number;
};

export function productQualityCounts(snapshot: StoreSnapshot): ProductQualityCounts {
  const products = snapshot.products;
  const descriptionsKnown = descriptionsWereSynced(snapshot);
  let missingTitle = 0;
  let missingPrice = 0;
  let missingImage = 0;
  let shortDescription = 0;
  let missingDescription = 0;
  let zeroInventoryTracked = 0;

  for (const product of products) {
    if (titleLooksIncomplete(product.title ?? "")) missingTitle += 1;
    if (!(product.price > 0)) missingPrice += 1;
    if (!product.imageUrl) missingImage += 1;
    if (descriptionsKnown) {
      const length =
        product.descriptionLength ??
        (typeof product.description === "string" ? product.description.trim().length : 0);
      if (length <= 0) missingDescription += 1;
      else if (length < SHORT_DESCRIPTION_CHARS) shortDescription += 1;
    }
    if (product.inventoryTracked !== false && product.inventoryQuantity <= 0) {
      zeroInventoryTracked += 1;
    }
  }

  return {
    total: products.length,
    missingTitle,
    missingPrice,
    missingImage,
    shortDescription,
    missingDescription,
    descriptionsKnown,
    zeroInventoryTracked,
  };
}

export function policyFlags(snapshot: StoreSnapshot): {
  known: boolean;
  refund: boolean;
  privacy: boolean;
  shipping: boolean;
  terms: boolean;
  missingCount: number;
} | null {
  const policies = snapshot.shopProfile?.policies;
  if (!policies) return null;
  const missing = [
    policies.refund,
    policies.privacy,
    policies.shipping,
    policies.terms,
  ].filter((ok) => !ok).length;
  return {
    known: true,
    refund: policies.refund,
    privacy: policies.privacy,
    shipping: policies.shipping,
    terms: policies.terms,
    missingCount: missing,
  };
}

export function ga4Sessions(snapshot: StoreSnapshot): number | null {
  if (!ga4Linked(snapshot)) return null;
  return snapshot.ga4Snapshot?.sessions30d ?? 0;
}

export function hasCostOrProfitSignal(
  snapshot: StoreSnapshot,
  profitDashboard?: ProfitDashboard | null,
  hasProductCosts = false,
): boolean {
  if (hasProductCosts) return true;
  if (snapshot.products.some((p) => p.unitCost != null && p.unitCost > 0)) return true;
  const margin = profitDashboard?.primary?.profitMarginPct;
  return margin != null && Number.isFinite(margin);
}
