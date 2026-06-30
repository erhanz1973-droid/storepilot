import type { RecommendationAnalyzer } from "./analyzer-types";

export const promotionsAnalyzer: RecommendationAnalyzer = {
  id: "promotions",
  category: "promotion_opportunity",
  analyze(snapshot) {
    const promoCandidate = snapshot.products.find(
      (p) => p.unitsSold30d >= 40 && p.inventoryQuantity >= 40 && !p.compareAtPrice,
    );
    if (!promoCandidate) return [];

    return [
      {
        id: `promo-${promoCandidate.id}`,
        category: "promotion_opportunity",
        title: `Promotion Opportunity — ${promoCandidate.title}`,
        description: `${promoCandidate.title} has healthy inventory (${promoCandidate.inventoryQuantity} units) and steady demand (${promoCandidate.unitsSold30d} sold / 30d). A limited-time offer could accelerate sell-through before seasonal demand shifts.`,
        priority: "medium",
        expectedImpact:
          "A targeted 10–15% offer could drive an estimated +20–30% unit lift over 14 days.",
        confidence: 0.74,
        evidence: [
          { label: "30-day units sold", value: String(promoCandidate.unitsSold30d) },
          { label: "Inventory on hand", value: String(promoCandidate.inventoryQuantity) },
          { label: "Price", value: `$${promoCandidate.price}` },
          { label: "30-day revenue", value: `$${promoCandidate.revenue30d.toLocaleString()}` },
        ],
        actions: [{ label: "Review", type: "review" }],
        entityType: "product",
        entityId: promoCandidate.id,
      },
    ];
  },
};
