import { describe, expect, it } from "vitest";
import { buildDemoSnapshot } from "@/lib/demo/get-demo-snapshot";
import { DEMO_SCENARIOS } from "@/lib/demo/scenarios/registry";
import type { DemoScenarioId } from "@/lib/demo/scenarios/types";
import { mergeIntegrationIntoSnapshot } from "@/lib/integrations/engine";
import { buildInventoryPageView } from "@/lib/inventory/engine";
import { computeProfitDashboard } from "@/lib/profit/engine";
import { computeInventorySummary } from "@/lib/inventory/summary";
import { isInventoryTrackingUnavailable } from "@/lib/inventory/summary";

const SCENARIO_IDS: DemoScenarioId[] = [
  "healthy_growth",
  "struggling",
  "scaling",
  "seasonal",
];

function mergedScenario(id: DemoScenarioId) {
  return mergeIntegrationIntoSnapshot(buildDemoSnapshot(id));
}

function productUnitsOnHand(snapshot: ReturnType<typeof mergedScenario>) {
  return snapshot.products.reduce((s, p) => s + p.inventoryQuantity, 0);
}

function productInventoryValue(snapshot: ReturnType<typeof mergedScenario>) {
  return snapshot.products.reduce(
    (s, p) => s + p.inventoryQuantity * (p.unitCost ?? p.price * 0.38),
    0,
  );
}

describe("demo scenario cross-module consistency", () => {
  for (const id of SCENARIO_IDS) {
    const def = DEMO_SCENARIOS[id];

    it(`${id}: store metrics match scenario registry`, () => {
      const snapshot = mergedScenario(id);
      expect(snapshot.storeMetrics.revenue30d).toBe(def.revenue30d);
      expect(snapshot.storeMetrics.orders30d).toBe(def.orders30d);
      expect(snapshot.storeMetrics.conversionRate30d).toBeCloseTo(def.conversionRatePct, 1);
    });

    it(`${id}: GA4 sessions and orders align with scenario`, () => {
      const snapshot = mergedScenario(id);
      expect(snapshot.ga4Snapshot?.sessions30d).toBe(def.sessions30d);
      expect(snapshot.ga4Snapshot?.purchases30d).toBe(def.orders30d);
      expect(snapshot.ga4Snapshot?.ecommerceConversionRatePct).toBeCloseTo(
        def.conversionRatePct,
        1,
      );
    });

    it(`${id}: inventory platform matches Shopify product quantities`, () => {
      const snapshot = mergedScenario(id);
      const units = productUnitsOnHand(snapshot);
      expect(units).toBeGreaterThan(0);
      expect(snapshot.integrationSnapshot?.inventory.unitsOnHand).toBe(units);
      expect(isInventoryTrackingUnavailable(snapshot.products)).toBe(false);
    });

    it(`${id}: inventory page shows non-zero warehouse value when stocked`, () => {
      const snapshot = mergedScenario(id);
      const profit = computeProfitDashboard(snapshot, []);
      const inventoryView = buildInventoryPageView({ snapshot, profitDashboard: profit });
      expect(inventoryView.executiveSummary.unitsOnHand.status).not.toBe("unavailable");
      expect(inventoryView.executiveSummary.inventoryValue.value).not.toBe("Unavailable");
      expect(productInventoryValue(snapshot)).toBeGreaterThan(0);
    });
  }

  it("healthy_growth: profitable with healthy inventory signals", () => {
    const snapshot = mergedScenario("healthy_growth");
    const profit = computeProfitDashboard(snapshot, []);
    const summary = computeInventorySummary(snapshot.products);
    const inventoryView = buildInventoryPageView({ snapshot, profitDashboard: profit });

    expect((profit?.primary.netProfit ?? 0)).toBeGreaterThan(0);
    expect(summary.outOfStock).toBe(0);
    expect(summary.lowStock).toBeLessThanOrEqual(2);
    expect(inventoryView.healthBreakdown.overall).toBeGreaterThanOrEqual(70);
    expect(productUnitsOnHand(snapshot)).toBeGreaterThan(500);
  });

  it("scaling: shows inventory pressure consistent with high-growth scenario", () => {
    const snapshot = mergedScenario("scaling");
    const summary = computeInventorySummary(snapshot.products);
    const lowStockHeroes = snapshot.products.filter(
      (p) => p.inventoryQuantity < 20 && p.unitsSold30d >= 10,
    );

    expect(lowStockHeroes.length).toBeGreaterThan(0);
    expect(summary.lowStock).toBeGreaterThan(0);
    expect(snapshot.integrationSnapshot?.inventory.lowStockSkus).toBeGreaterThan(0);
  });

  it("struggling: negative revenue trend in salesTrends", () => {
    const snapshot = mergedScenario("struggling");
    const prev = snapshot.salesTrends?.previous30Days.revenue ?? 0;
    const current = snapshot.storeMetrics.revenue30d;
    expect(current).toBeLessThan(prev);
  });

  it("seasonal: strong growth vs previous period", () => {
    const snapshot = mergedScenario("seasonal");
    expect(snapshot.salesTrends?.previous30Days.revenue).toBe(22_000);
    expect(snapshot.storeMetrics.revenue30d).toBeGreaterThan(
      (snapshot.salesTrends?.previous30Days.revenue ?? 0) * 4,
    );
  });

  it("google ads spend aligns with scenario registry", () => {
    for (const id of SCENARIO_IDS) {
      const snapshot = mergedScenario(id);
      const spend7d =
        snapshot.googleAdsSnapshot?.campaigns.reduce((s, c) => s + c.spend7d, 0) ?? 0;
      expect(spend7d).toBeCloseTo(DEMO_SCENARIOS[id].googleSpend7d, 0);
    }
  });
});
