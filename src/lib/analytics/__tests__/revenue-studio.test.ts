import { describe, expect, it } from "vitest";
import { getPeakOutfittersSnapshot } from "@/lib/connectors/demo-data";
import { computeProfitDashboard } from "@/lib/profit/engine";
import { buildRevenueStudio } from "@/lib/analytics/revenue-studio";
import { buildDailyAiPlaybook } from "@/lib/analytics/ai-daily-playbook";
import { buildSalesManagerView } from "@/lib/analytics/sales-manager";

describe("revenue studio", () => {
  it("builds merchant-facing playbooks without exposing internal scores", () => {
    const snapshot = getPeakOutfittersSnapshot();
    const profitDashboard = computeProfitDashboard(snapshot, []);
    const studio = buildRevenueStudio({ snapshot, profitDashboard });

    expect(studio.headline).toBe("Revenue Playbooks");
    expect(studio.playbooks.length).toBeGreaterThan(0);
    expect(studio.workflow).toEqual([
      "Preview",
      "Send to Approval Center",
      "Merchant Approval",
      "Launch",
    ]);

    const bundle = studio.playbooks.find((p) => p.kind === "bundle");
    expect(bundle).toBeDefined();
    expect(bundle!.whyBullets.length).toBeGreaterThan(0);
    expect(bundle!.whyBullets.every((b) => !b.includes("weight") && !b.includes("score"))).toBe(true);
    expect(bundle!.confidenceExplanation.length).toBeGreaterThan(20);
    expect(bundle!.approvalHref).toContain("/approvals?playbook=");
    expect(bundle!.timeToLaunch).toMatch(/minute/);
    expect(bundle!.inventoryImpact.length).toBeGreaterThan(5);

    const serialized = JSON.stringify(studio);
    expect(serialized).not.toContain("bundleScore");
    expect(serialized).not.toContain("weightPct");
    expect(serialized).not.toContain('"signals"');
  });

  it("generates additional revenue playbook types", () => {
    const studio = buildRevenueStudio({
      snapshot: getPeakOutfittersSnapshot(),
      profitDashboard: computeProfitDashboard(getPeakOutfittersSnapshot(), []),
    });

    const kinds = new Set(studio.playbooks.map((p) => p.kind));
    expect(kinds.has("bundle")).toBe(true);
    expect(kinds.has("free_shipping_threshold")).toBe(true);
    expect(kinds.has("abandoned_cart_recovery")).toBe(true);
  });

  it("includes business decision preview fields and approval routing", () => {
    const studio = buildRevenueStudio({
      snapshot: getPeakOutfittersSnapshot(),
      profitDashboard: computeProfitDashboard(getPeakOutfittersSnapshot(), []),
    });

    const playbook = studio.playbooks[0]!;
    expect(playbook.businessReasoning.length).toBeGreaterThan(10);
    expect(playbook.productsAffected.length).toBeGreaterThan(0);
    expect(playbook.risks.length).toBeGreaterThan(0);
    expect(playbook.approvalHref).toContain("/approvals");
    expect(playbook.category.length).toBeGreaterThan(5);
  });

  it("is wired into sales manager v2 with daily playbook", () => {
    const view = buildSalesManagerView({
      snapshot: getPeakOutfittersSnapshot(),
      profitDashboard: computeProfitDashboard(getPeakOutfittersSnapshot(), []),
    });

    expect(view.v2.revenueStudio.playbooks.length).toBeGreaterThan(0);
    expect(view.v2.dailyPlaybook.items.length).toBeGreaterThan(0);
    expect(view.v2.dailyPlaybook.title).toBe("Today's AI Playbook");
  });
});

describe("daily ai playbook", () => {
  it("aggregates cross-module actions by impact", () => {
    const snapshot = getPeakOutfittersSnapshot();
    const profitDashboard = computeProfitDashboard(snapshot, []);
    const revenueStudio = buildRevenueStudio({ snapshot, profitDashboard });
    const view = buildSalesManagerView({ snapshot, profitDashboard });

    const daily = buildDailyAiPlaybook({
      snapshot,
      revenueStudio,
      salesOpportunities: view.v2.opportunities,
    });

    expect(daily.items.length).toBeGreaterThan(0);
    expect(daily.items[0]!.rank).toBe(1);
    for (let i = 1; i < daily.items.length; i++) {
      const prev = daily.items[i - 1]!.impactMonthly ?? 0;
      const curr = daily.items[i]!.impactMonthly ?? 0;
      expect(prev).toBeGreaterThanOrEqual(curr);
    }
  });
});
