import { describe, expect, it } from "vitest";
import { validateAttributionConfidence } from "@/lib/validation/attribution";
import { manualNetProfit, manualGrossProfit } from "@/lib/validation/profit";
import { manualRoas } from "@/lib/validation/roas";
import { validateMetricRegistry } from "@/lib/validation/metric-validation";
import { METRIC_REGISTRY } from "@/lib/validation/metric-registry";
import { validateProfitEngine, validateRoasEngine } from "@/lib/validation/performance";
import { profitRollupsForOrders } from "@/lib/validation/fixtures/orders";
import { validateAppStoreReadiness } from "@/lib/validation/app-store-readiness";

describe("profit engine validation", () => {
  it("manual gross profit is revenue minus COGS", () => {
    const rollups = profitRollupsForOrders(100);
    const bucket = rollups.last30d;
    expect(manualGrossProfit(bucket)).toBe(
      Math.round((bucket.revenue - bucket.cogs) * 100) / 100,
    );
  });

  it("StorePilot profit matches manual calculation (0% tolerance)", () => {
    const checks = validateProfitEngine();
    const failures = checks.filter((c) => c.status === "fail");
    expect(failures).toEqual([]);
  });

  it("manual net profit deducts fees, ad spend, and ops costs", () => {
    const rollups = profitRollupsForOrders(612);
    const net = manualNetProfit(rollups.last30d, 4200, 580);
    expect(typeof net).toBe("number");
    expect(net).toBeLessThan(rollups.last30d.revenue);
  });
});

describe("ROAS validation", () => {
  it("manual ROAS equals revenue / spend", () => {
    expect(manualRoas(1000, 400)).toBe(2.5);
    expect(manualRoas(1000, 0)).toBeNull();
  });

  it("Blended ROAS periods match manual calculations", () => {
    const checks = validateRoasEngine();
    const failures = checks.filter((c) => c.status === "fail");
    expect(failures).toEqual([]);
  });
});

describe("metric registry validation", () => {
  it("documents core commerce and ads metrics", () => {
    expect(METRIC_REGISTRY.length).toBeGreaterThanOrEqual(20);
    const ids = METRIC_REGISTRY.map((m) => m.id);
    expect(ids).toContain("shopify.revenue_30d");
    expect(ids).toContain("profit.net_profit");
    expect(ids).toContain("roas.blended");
  });

  it("registry validation suite has no failures", () => {
    const checks = validateMetricRegistry();
    const failures = checks.filter((c) => c.status === "fail");
    expect(failures).toEqual([]);
  });
});

describe("attribution confidence validation", () => {
  it("never reports High confidence when data is incomplete", () => {
    const checks = validateAttributionConfidence();
    const organic = checks.find((c) => c.id === "attribution-organic-only");
    expect(organic?.status).toBe("pass");
    expect(organic?.actual).not.toMatch(/^High/);
  });

  it("all attribution scenarios produce expected confidence bands", () => {
    const checks = validateAttributionConfidence();
    const failures = checks.filter((c) => c.status === "fail");
    expect(failures.map((f) => f.name)).toEqual([]);
  });
});

describe("App Store commercial model validation", () => {
  it("reports the Free Early Access billing status", () => {
    const check = validateAppStoreReadiness().find(
      (candidate) => candidate.id === "appstore-free-commercial-model",
    );

    expect(check?.status).toBe("pass");
    expect(check?.name).toBe("Billing Status: FREE RELEASE");
    expect(check?.actual).toBe("FREE RELEASE");
    expect(check?.message).toBe("Free Early Access — no Billing API required");
  });
});
