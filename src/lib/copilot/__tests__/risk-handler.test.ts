import { describe, expect, it } from "vitest";
import { buildAttributionDashboard } from "@/lib/attribution/engine";
import { buildCopilotRiskResponse } from "@/lib/copilot/risk-handler";
import { buildCustomerIntelligence } from "@/lib/customers/engine";
import { getPeakOutfittersSnapshot } from "@/lib/demo/peak-outfitters";
import { computeProfitDashboard } from "@/lib/profit/engine";
import { computeStoreHealthScore } from "@/lib/store-health/score";
import type { CopilotDataBundle } from "@/lib/copilot/data";

describe("copilot biggest risk handler", () => {
  it("returns cross-module risk assessment instead of marketing-only feed", async () => {
    const snapshot = getPeakOutfittersSnapshot();
    const profitDashboard = computeProfitDashboard(snapshot, [])!;
    const attributionDashboard = buildAttributionDashboard(snapshot, profitDashboard)!;

    const bundle = {
      context: {
        profitDashboard,
        attributionDashboard,
        productIntelligence: null,
        hasActiveAdsConnector: true,
      },
      storeManager: { opportunityFeed: [] },
      storeHealth: computeStoreHealthScore({
        snapshot,
        profitDashboard,
        productIntelligence: null,
        attributionDashboard,
        activeRecommendations: [],
      }),
      snapshot,
      commerce: {} as CopilotDataBundle["commerce"],
      predictiveInsights: [],
      customerIntelligence: buildCustomerIntelligence({
        snapshot,
        attribution: attributionDashboard,
        profitDashboard,
      }),
    } as unknown as CopilotDataBundle;

    const response = buildCopilotRiskResponse(bundle, [
      "profit",
      "attribution",
      "customers",
      "shopify",
      "store_health",
    ]);

    expect(response.intent).toBe("biggest_risk");
    expect(response.riskAssessment).toBeDefined();
    expect(response.riskAssessment!.categories.length).toBe(7);
    expect(response.summary.toLowerCase()).toContain("biggest risk");
    expect(response.recommendations.length).toBe(3);
    const reasons = response.recommendations.map((r) => r.detail);
    expect(new Set(reasons).size).toBe(reasons.length);
  });
});
