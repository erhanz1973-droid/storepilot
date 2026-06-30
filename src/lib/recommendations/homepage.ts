import type { RecommendationAnalyzer } from "./analyzer-types";

export const homepageAnalyzer: RecommendationAnalyzer = {
  id: "homepage",
  category: "homepage_merchandising",
  analyze(snapshot) {
    const topCollection = [...snapshot.collections].sort(
      (a, b) => b.revenue30d - a.revenue30d,
    )[0];
    const featured = snapshot.collections.find((c) => c.homepageFeatured);

    if (!topCollection || !featured || topCollection.id === featured.id) {
      return [];
    }

    return [
      {
        id: `home-${topCollection.id}`,
        category: "homepage_merchandising",
        title: "Homepage Merchandising Opportunity",
        description: `"${topCollection.title}" generated $${topCollection.revenue30d.toLocaleString()} in 30 days but is not featured on the homepage. "${featured.title}" is featured with lower revenue.`,
        priority: "high",
        expectedImpact:
          "Surfacing top-performing collection on homepage could lift homepage-to-collection CTR by 10–18%.",
        confidence: 0.8,
        evidence: [
          { label: "Top collection revenue", value: `$${topCollection.revenue30d.toLocaleString()}` },
          { label: "Featured collection revenue", value: `$${featured.revenue30d.toLocaleString()}` },
          { label: "Top collection products", value: String(topCollection.productCount) },
          { label: "Store conversion rate", value: `${snapshot.storeMetrics.conversionRate30d}%` },
        ],
        actions: [{ label: "Review", type: "review" }],
        entityType: "collection",
        entityId: topCollection.id,
      },
    ];
  },
};
