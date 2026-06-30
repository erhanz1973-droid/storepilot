import { describe, expect, it } from "vitest";
import { handleCustomerTop } from "@/lib/copilot/customer-handler";
import { buildCustomerIntelligence } from "@/lib/customers/engine";
import { getPeakOutfittersSnapshot } from "@/lib/demo/peak-outfitters";
import { computeProfitDashboard } from "@/lib/profit/engine";

describe("customer copilot handler", () => {
  it("returns top customers with insights for demo data", () => {
    const snapshot = getPeakOutfittersSnapshot();
    const dashboard = buildCustomerIntelligence({
      snapshot,
      profitDashboard: computeProfitDashboard(snapshot, [])!,
    })!;

    const response = handleCustomerTop(dashboard, ["customers", "shopify"]);

    expect(response.intent).toBe("customer_top");
    expect(response.title).toBe("Your top customers");
    expect(response.summary).toContain("top customer has spent");
    expect(response.summary).toContain("10% of customers");
    expect(response.summary).toContain("Lifetime Spend");
    expect(response.recommendations.some((r) => r.action.includes("VIP"))).toBe(true);
    expect(response.evidence.length).toBeGreaterThan(0);
    expect(response.unlockCapabilities).toBeUndefined();
  });

  it("returns actionable guidance when customer records are missing", () => {
    const response = handleCustomerTop(null, ["customers"]);

    expect(response.title).toBe("Customer Intelligence is not available yet");
    expect(response.summary).toContain("have not been synchronized");
    expect(response.summary).not.toContain("hasn't been synced");
    expect(response.unlockCapabilities?.length).toBeGreaterThan(10);
    expect(response.futureInsightExamples?.length).toBeGreaterThan(3);
    expect(response.recommendations[0]?.action).toBe("Connect Shopify Customers & Orders");
    expect(response.businessImpact.calculable).toBe(true);
    expect(response.businessImpact.label).toContain("retention");
    expect(response.summary).not.toContain("Lifetime Spend: $");
  });
});
