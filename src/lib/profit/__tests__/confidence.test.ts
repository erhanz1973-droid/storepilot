import { describe, expect, it } from "vitest";
import { DEMO_STORE_SNAPSHOT } from "@/lib/connectors/demo-data";
import { computeProfitConfidence } from "@/lib/profit/confidence";
import { computeProfitDashboard } from "@/lib/profit/engine";
import { detectProfitInputs } from "@/lib/profit/input-availability";
import { productCostMap } from "@/lib/db/product-costs";

describe("profit confidence system", () => {
  it("detects available inputs from demo store snapshot", () => {
    const costs = productCostMap([]);
    const inputs = detectProfitInputs(DEMO_STORE_SNAPSHOT, DEMO_STORE_SNAPSHOT.products, costs);
    const revenue = inputs.find((i) => i.id === "revenue");
    const cogs = inputs.find((i) => i.id === "product_costs");
    expect(revenue?.available).toBe(true);
    expect(cogs?.available).toBe(true);
  });

  it("returns estimated status for demo store (estimated payment fees)", () => {
    const confidence = computeProfitConfidence(
      DEMO_STORE_SNAPSHOT.products,
      productCostMap([]),
      DEMO_STORE_SNAPSHOT,
    );
    expect(["estimated", "verified"]).toContain(confidence.status);
    expect(confidence.scorePct).toBeGreaterThan(0);
    expect(confidence.missingInputs.length).toBeGreaterThan(0);
    expect(confidence.setupRequired).toBe(confidence.status !== "verified");
  });

  it("exposes reusable profit metadata on dashboard", () => {
    const dashboard = computeProfitDashboard(DEMO_STORE_SNAPSHOT, []);
    expect(dashboard).not.toBeNull();
    expect(dashboard!.primaryProfit).toMatchObject({
      status: expect.stringMatching(/verified|estimated|unavailable/),
      confidence: expect.any(Number),
      missingInputs: expect.any(Array),
    });
    expect(dashboard!.primary.netProfitMeta.status).toBe(dashboard!.primaryProfit.status);
  });

  it("blocks profit value when status is unavailable", () => {
    const snapshot = {
      ...DEMO_STORE_SNAPSHOT,
      profitRollups: DEMO_STORE_SNAPSHOT.profitRollups
        ? {
            ...DEMO_STORE_SNAPSHOT.profitRollups,
            last30d: {
              ...DEMO_STORE_SNAPSHOT.profitRollups.last30d,
              revenue: 0,
              orders: 0,
            },
          }
        : undefined,
    };
    const dashboard = computeProfitDashboard(snapshot, []);
    expect(dashboard).not.toBeNull();
    expect(dashboard!.confidence.status).toBe("unavailable");
    expect(dashboard!.primaryProfit.value).toBeNull();
    expect(dashboard!.primary.netProfit).toBeNull();
  });

  it("marks all-missing product costs as unavailable", () => {
    const products = DEMO_STORE_SNAPSHOT.products.map((p) => ({
      ...p,
      unitCost: undefined as number | undefined,
      unitsSold30d: p.unitsSold30d > 0 ? p.unitsSold30d : 5,
    }));
    const snapshot = { ...DEMO_STORE_SNAPSHOT, products };
    const confidence = computeProfitConfidence(products, productCostMap([]), snapshot);
    expect(confidence.status).toBe("unavailable");
    expect(confidence.missingInputs).toContain("product_costs");
  });
});
