import type { RecommendationAnalyzer } from "./analyzer-types";

export const bundlesAnalyzer: RecommendationAnalyzer = {
  id: "bundles",
  category: "bundle_opportunity",
  analyze(snapshot) {
    const bundleCandidates = snapshot.products.filter((p) =>
      p.tags.includes("bundle-candidate"),
    );
    if (bundleCandidates.length < 2) return [];

    const combinedRevenue = bundleCandidates.reduce((s, p) => s + p.revenue30d, 0);

    return [
      {
        id: "bundle-daily-routine",
        category: "bundle_opportunity",
        title: "Bundle Opportunity — Daily Routine Set",
        description: `Customers often buy ${bundleCandidates.map((p) => p.title).join(" and ")} separately. A bundled offer could lift average order value without discounting hero SKUs.`,
        priority: "medium",
        expectedImpact:
          "Estimated +8–15% AOV if bundle converts at 12% attach rate on routine buyers.",
        confidence: 0.71,
        evidence: [
          { label: "Bundle SKUs", value: String(bundleCandidates.length) },
          { label: "Combined 30-day revenue", value: `$${combinedRevenue.toLocaleString()}` },
          { label: "Store AOV", value: `$${snapshot.storeMetrics.aov30d.toFixed(2)}` },
          { label: "Orders (30d)", value: String(snapshot.storeMetrics.orders30d) },
        ],
        actions: [{ label: "Review", type: "review" }],
      },
    ];
  },
};
