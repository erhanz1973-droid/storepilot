import type { StoreSnapshot } from "@/lib/connectors/types";
import type { ProductIntelligenceProfile } from "./types";

export function detectHiddenWinners(
  products: ProductIntelligenceProfile[],
  snapshot: StoreSnapshot,
): ProductIntelligenceProfile[] {
  const storeAdSpend = snapshot.adSpendSnapshot?.totalRollups.last30d.spend ?? 0;
  const avgAdShare =
    products.length > 0 && storeAdSpend > 0
      ? storeAdSpend / products.length
      : 0;

  return products
    .filter((p) => {
      if (p.netProfit <= 0 || p.marginPct < 30) return false;
      const lowAd = p.adCost < avgAdShare * 0.5;
      const underFeatured = !snapshot.collections.some(
        (c) => c.homepageFeatured && snapshot.products.find((sp) => sp.id === p.productId)?.collectionIds.includes(c.id),
      );
      return lowAd && (p.marginPct >= 40 || underFeatured);
    })
    .sort((a, b) => b.netProfit - a.netProfit)
    .slice(0, 5)
    .map((p) => ({
      ...p,
      isHiddenWinner: true,
      hiddenWinnerReason:
        p.adCost < avgAdShare * 0.3
          ? "Receives very little advertising but generates excellent profit margins."
          : "Strong margins with untapped merchandising and ad scaling potential.",
    }));
}
