import type { ProductIntelligenceProfile } from "./types";

export function detectHeroProducts(
  products: ProductIntelligenceProfile[],
): ProductIntelligenceProfile[] {
  const heroes: ProductIntelligenceProfile[] = [];

  const topProfit = [...products].sort((a, b) => b.netProfit - a.netProfit)[0];
  if (topProfit && topProfit.netProfit > 0) {
    heroes.push({
      ...topProfit,
      isHero: true,
      heroReason: "Generated the highest net profit over the last 30 days.",
    });
  }

  const highMargin = products.filter(
    (p) => p.marginPct >= 45 && p.netProfit > 0 && p.productId !== topProfit?.productId,
  );
  if (highMargin.length > 0) {
    const best = highMargin.sort((a, b) => b.netProfit - a.netProfit)[0];
    heroes.push({
      ...best,
      isHero: true,
      heroReason: `Maintains a ${best.marginPct}% profit margin with strong net profit.`,
    });
  }

  const fastGrower = products
    .filter((p) => (p.trends.revenueGrowthPct ?? 0) > 20 && p.netProfit > 0)
    .sort((a, b) => (b.trends.revenueGrowthPct ?? 0) - (a.trends.revenueGrowthPct ?? 0))[0];
  if (fastGrower && !heroes.some((h) => h.productId === fastGrower.productId)) {
    heroes.push({
      ...fastGrower,
      isHero: true,
      heroReason: `Revenue grew ${fastGrower.trends.revenueGrowthPct}% vs the prior 30 days.`,
    });
  }

  return heroes.slice(0, 3);
}
