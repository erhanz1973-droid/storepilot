import { allowDemoData } from "@/lib/env/runtime";
import type { ShopifyProduct, StoreSnapshot } from "@/lib/connectors/types";
import type { AttributionEvent } from "@/lib/attribution/models";
import type { AttributionMethod, CampaignProductLink } from "@/lib/attribution/product-types";
import { PEAK_OUTFITTERS_CAMPAIGN_PRODUCTS } from "@/lib/demo/peak-outfitters/campaign-products";

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Resolve landing page path to product IDs */
export function resolveLandingPageProducts(
  landingPage: string,
  products: ShopifyProduct[],
): string[] {
  const path = landingPage.split("?")[0] ?? landingPage;
  const productMatch = path.match(/\/products\/([^/]+)/);
  if (productMatch) {
    const slug = productMatch[1]!;
    const hit = products.find(
      (p) =>
        slugify(p.title).includes(slug) ||
        slug.includes(slugify(p.title).slice(0, 12)),
    );
    if (hit) return [hit.id];
  }

  const collectionMatch = path.match(/\/collections\/([^/]+)/);
  if (collectionMatch) {
    const colSlug = collectionMatch[1]!;
    return products
      .filter((p) =>
        p.collectionIds.some((cid) => cid.toLowerCase().includes(colSlug.replace(/-/g, ""))),
      )
      .map((p) => p.id);
  }

  return [];
}

const CAMPAIGN_KEYWORDS: { pattern: RegExp; collectionHint: string }[] = [
  { pattern: /hiking|backpack/i, collectionHint: "backpack" },
  { pattern: /boot|trail/i, collectionHint: "boot" },
  { pattern: /tent|camp/i, collectionHint: "tent" },
  { pattern: /sleep/i, collectionHint: "sleep" },
  { pattern: /bottle|hydration/i, collectionHint: "bottle" },
  { pattern: /stove|grill/i, collectionHint: "stove" },
  { pattern: /flash|lamp|lantern/i, collectionHint: "flash" },
  { pattern: /clearance|spring collection/i, collectionHint: "clearance" },
  { pattern: /retarget|cart/i, collectionHint: "" },
  { pattern: /prospect|broad/i, collectionHint: "" },
];

function productsForCollectionHint(products: ShopifyProduct[], hint: string): string[] {
  if (!hint) return [];
  return products
    .filter(
      (p) =>
        p.collectionIds.some((c) => c.toLowerCase().includes(hint)) ||
        p.title.toLowerCase().includes(hint),
    )
    .map((p) => p.id);
}

/** Heuristic campaign name → product IDs */
export function inferCampaignProducts(
  campaignId: string,
  campaignName: string,
  products: ShopifyProduct[],
): { productIds: string[]; method: AttributionMethod; confidencePct: number } {
  for (const { pattern, collectionHint } of CAMPAIGN_KEYWORDS) {
    if (!pattern.test(campaignName)) continue;
    const ids = productsForCollectionHint(products, collectionHint);
    if (ids.length > 0) {
      return { productIds: ids, method: "campaign_attribution", confidencePct: 82 };
    }
    if (/retarget|cart/i.test(campaignName)) {
      const bestsellers = products
        .filter((p) => p.unitsSold30d >= 40)
        .sort((a, b) => b.revenue30d - a.revenue30d)
        .slice(0, 6)
        .map((p) => p.id);
      return { productIds: bestsellers, method: "campaign_attribution", confidencePct: 78 };
    }
    if (/prospect|broad/i.test(campaignName)) {
      return {
        productIds: products.filter((p) => p.revenue30d > 0).map((p) => p.id),
        method: "revenue_allocation",
        confidencePct: 65,
      };
    }
  }
  return { productIds: [], method: "unknown", confidencePct: 0 };
}

export function buildCampaignProductLinks(
  snapshot: StoreSnapshot,
): CampaignProductLink[] {
  const links: CampaignProductLink[] = [];
  const seen = new Set<string>();

  const add = (link: CampaignProductLink) => {
    if (seen.has(link.campaignId)) return;
    seen.add(link.campaignId);
    links.push(link);
  };

  if (allowDemoData() && snapshot.source === "demo") {
    for (const link of PEAK_OUTFITTERS_CAMPAIGN_PRODUCTS) {
      add(link);
    }
  }

  for (const campaign of snapshot.campaigns) {
    if (seen.has(campaign.id)) continue;
    const inferred = inferCampaignProducts(campaign.id, campaign.name, snapshot.products);
    if (inferred.productIds.length > 0) {
      add({
        campaignId: campaign.id,
        productIds: inferred.productIds,
        method: inferred.method,
        confidencePct: inferred.confidencePct,
      });
    }
  }

  for (const c of snapshot.googleAdsSnapshot?.campaigns ?? []) {
    if (seen.has(c.id)) continue;
    const inferred = inferCampaignProducts(c.id, c.name, snapshot.products);
    if (inferred.productIds.length > 0) {
      add({
        campaignId: c.id,
        productIds: inferred.productIds,
        method: inferred.method,
        confidencePct: inferred.confidencePct,
      });
    }
  }

  return links;
}

/** Build product → channel revenue from attribution events + landing pages */
export function buildProductSourceRevenue(
  snapshot: StoreSnapshot,
): Map<string, import("@/lib/attribution/product-types").ProductRevenueSources> {
  const map = new Map<string, import("@/lib/attribution/product-types").ProductRevenueSources>();
  const events = snapshot.attributionEvents ?? [];

  const empty = () => ({
    meta: 0,
    google: 0,
    organic: 0,
    direct: 0,
    email: 0,
    referral: 0,
  });

  const channelKey = (
    channelId: AttributionEvent["channelId"],
  ): keyof import("@/lib/attribution/product-types").ProductRevenueSources => {
    if (channelId === "meta_ads") return "meta";
    if (channelId === "google_ads") return "google";
    if (channelId === "email") return "email";
    if (channelId === "referral") return "referral";
    if (channelId === "direct") return "direct";
    if (channelId === "organic_search" || channelId === "organic") return "organic";
    return "organic";
  };

  const orderTouches = new Map<string, AttributionEvent[]>();
  for (const e of events) {
    if (!e.orderId) continue;
    const list = orderTouches.get(e.orderId) ?? [];
    list.push(e);
    orderTouches.set(e.orderId, list);
  }

  for (const [, touches] of orderTouches) {
    const orderValue = touches.find((t) => t.orderValue != null)?.orderValue ?? 0;
    if (orderValue <= 0) continue;

    const lastTouch = touches[touches.length - 1]!;
    const productIds = resolveLandingPageProducts(
      lastTouch.landingPage ?? "/",
      snapshot.products,
    );
    const targets =
      productIds.length > 0
        ? productIds
        : snapshot.products
            .filter((p) => p.revenue30d > 0)
            .sort((a, b) => b.revenue30d - a.revenue30d)
            .slice(0, 1)
            .map((p) => p.id);

    const perProduct = orderValue / targets.length;
    const creditChannel = channelKey(lastTouch.channelId);

    for (const pid of targets) {
      const row = map.get(pid) ?? empty();
      row[creditChannel] = Math.round((row[creditChannel] + perProduct) * 100) / 100;
      map.set(pid, row);
    }
  }

  return map;
}
