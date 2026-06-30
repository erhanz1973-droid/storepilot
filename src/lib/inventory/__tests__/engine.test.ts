import { buildProductAttributionDashboard } from "@/lib/attribution/product-engine";
import { getPeakOutfittersSnapshot } from "@/lib/demo/peak-outfitters";
import { buildInventoryPageView } from "@/lib/inventory/engine";
import { buildProductIntelligence } from "@/lib/products/engine";
import { computeProfitDashboard } from "@/lib/profit/engine";
import { describe, expect, it } from "vitest";

describe("buildInventoryPageView", () => {
  it("classifies dead inventory from full catalog including zero-sale SKUs", () => {
    const snapshot = getPeakOutfittersSnapshot();
    const profitDashboard = computeProfitDashboard(snapshot, [])!;
    const intelligence = buildProductIntelligence(snapshot, [], profitDashboard)!;
    const view = buildInventoryPageView({
      snapshot,
      intelligence,
    })!;

    const dead = view.segments.find((s) => s.id === "dead");
    expect(dead!.count).toBeGreaterThanOrEqual(3);
    expect(view.riskTable.some((r) => r.title.includes("Wool Base Layer"))).toBe(true);
  });

  it("builds executive summary from all products", () => {
    const snapshot = getPeakOutfittersSnapshot();
    const profitDashboard = computeProfitDashboard(snapshot, [])!;
    const intelligence = buildProductIntelligence(snapshot, [], profitDashboard)!;
    const view = buildInventoryPageView({ snapshot, intelligence })!;

    expect(view.executiveSummary.totalSkus.value).toBe(
      snapshot.products.length.toLocaleString(),
    );
    expect(view.executiveSummary.unitsOnHand.status).toBe("verified");
    expect(view.executiveSummary.inventoryCoverage.value).toContain("days");
    expect(view.healthBreakdown.factors.length).toBe(4);
    expect(view.healthBreakdown.overall).toBeGreaterThan(0);
    expect(view.aiInsights.length).toBeGreaterThan(0);
  });

  it("penalizes health score when all SKUs are out of stock", () => {
    const snapshot = getPeakOutfittersSnapshot();
    snapshot.products = [
      {
        ...snapshot.products[0]!,
        inventoryQuantity: 0,
        unitsSold30d: 18,
        revenue30d: 900,
      },
    ];

    const profitDashboard = computeProfitDashboard(snapshot, [])!;
    const intelligence = buildProductIntelligence(snapshot, [], profitDashboard)!;
    const view = buildInventoryPageView({ snapshot, intelligence })!;

    expect(view.healthBreakdown.overall).toBeLessThan(50);
    expect(view.executiveSummary.inventoryCoverage.value).toBe("0 days");
    expect(view.limitedInventoryNotice).toBeTruthy();
    expect(view.riskTable[0]?.estimatedStockoutLabel).toBe("Already Out of Stock");
  });

  it("surfaces restock and clearance opportunities", () => {
    const snapshot = getPeakOutfittersSnapshot();
    const profitDashboard = computeProfitDashboard(snapshot, [])!;
    const attribution = buildProductAttributionDashboard(snapshot, [], profitDashboard)!;
    const intelligence = buildProductIntelligence(
      snapshot,
      [],
      profitDashboard,
      attribution,
    )!;
    const view = buildInventoryPageView({
      snapshot,
      intelligence,
      attribution,
    })!;

    expect(view.riskTable.length).toBeGreaterThan(0);
    expect(view.riskTable.some((r) => r.recommendation != null)).toBe(true);
  });
});
