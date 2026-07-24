import type { StoreSnapshot } from "@/lib/connectors/types";
import { isDemoStoreSnapshot } from "@/lib/demo/is-demo-store";
import { allowDemoData } from "@/lib/env/runtime";
import { peakOutfittersOrderIntelligenceSeeds } from "@/lib/demo/peak-outfitters/order-intelligence";
import type { ProductIntelligenceProfile } from "./types";

export type ProductRelatedItem = {
  productId: string;
  title: string;
  reason: string;
};

export type ProductRecentOrder = {
  orderId: string;
  externalId: string;
  customer: string;
  revenue: number;
  date: string;
};

export type ProductInventoryPoint = {
  week: string;
  quantity: number;
};

export function productSkuFromId(productId: string): string {
  const short = productId.split("/").pop() ?? productId;
  return short.replace(/^po-/i, "PO-").toUpperCase();
}

export function collectionTitleForProduct(
  snapshot: StoreSnapshot,
  productId: string,
): string {
  const product = snapshot.products.find((p) => p.id === productId);
  if (!product?.collectionIds.length) return "—";
  const colId = product.collectionIds[0]!.split("/").pop();
  const col = snapshot.collections.find((c) => c.id.includes(colId ?? ""));
  return col?.title ?? "—";
}

export function findRelatedProducts(
  profile: ProductIntelligenceProfile,
  all: ProductIntelligenceProfile[],
  snapshot: StoreSnapshot,
): ProductRelatedItem[] {
  const product = snapshot.products.find((p) => p.id === profile.productId);
  const collectionId = product?.collectionIds[0];
  const related = all
    .filter((p) => p.productId !== profile.productId)
    .filter((other) => {
      const op = snapshot.products.find((sp) => sp.id === other.productId);
      if (collectionId && op?.collectionIds.includes(collectionId)) return true;
      return other.isHero || other.isHiddenWinner;
    })
    .slice(0, 4);

  return related.map((r) => ({
    productId: r.productId,
    title: r.title,
    reason:
      r.isHiddenWinner
        ? "Hidden winner — bundle candidate"
        : r.lifecycleStage === "Winning"
          ? "Top seller in same collection"
          : "Same collection",
  }));
}

export function recentOrdersForProduct(
  snapshot: StoreSnapshot,
  productId: string,
): ProductRecentOrder[] {
  if (!allowDemoData() || !isDemoStoreSnapshot(snapshot)) return [];

  return peakOutfittersOrderIntelligenceSeeds()
    .filter((order) => order.lines.some((line) => line.productId === productId))
    .slice(0, 5)
    .map((order) => ({
      orderId: order.id,
      externalId: order.externalId,
      customer: order.customerName,
      revenue: order.revenue,
      date: order.createdAt,
    }));
}

export function inventoryHistoryForProduct(
  profile: ProductIntelligenceProfile,
): ProductInventoryPoint[] {
  const velocity = profile.unitsSold / 30;
  const points: ProductInventoryPoint[] = [];
  const now = new Date();

  for (let w = 3; w >= 0; w--) {
    const d = new Date(now);
    d.setDate(d.getDate() - w * 7);
    const qty = Math.max(
      0,
      Math.round(profile.inventory + velocity * 7 * w),
    );
    points.push({
      week: d.toISOString().slice(0, 10),
      quantity: qty,
    });
  }

  return points;
}
