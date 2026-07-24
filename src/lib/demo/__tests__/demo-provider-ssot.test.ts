import { describe, expect, it } from "vitest";
import { getAlpineOutfittersSnapshot } from "@/lib/demo/alpine-outfitters";
import { ALPINE_UI_METRICS, getAlpineHeroRecommendation } from "@/lib/demo/alpine-outfitters/ui-metrics";
import { getDemoDataProvider } from "@/lib/demo/provider";
import {
  applyDemoExecutiveKpis,
  applyDemoProfitDashboard,
  getAlpineRecoverableProfitPresentation,
  resolveDemoModeRecommendations,
} from "@/lib/demo/showcase-overrides";
import { computeProfitDashboard } from "@/lib/profit/engine";
import { generateRecommendations } from "@/lib/recommendations/registry";
import type { ExecutiveKpi } from "@/lib/analytics/executive-advisor-enrichment";

describe("Demo Provider single source of truth", () => {
  const snapshot = getAlpineOutfittersSnapshot();
  const provider = getDemoDataProvider();

  it("exposes full UI metrics catalog", () => {
    expect(provider).not.toBeNull();
    const metrics = provider!.getUiMetrics();
    expect(metrics.revenue30d).toBe(82_450);
    expect(metrics.profit30d).toBe(16_870);
    expect(metrics.blendedRoas).toBe(4.38);
    expect(metrics.storeHealthScore).toBe(94);
    expect(metrics.aiConfidencePct).toBe(98);
    expect(metrics.recoverableProfitOpportunity).toBeGreaterThan(1000);
    expect(metrics.recommendationCount).toBe(6);
  });

  it("Recoverable Profit Opportunity comes from Demo Provider hero, not ~$103 leftovers", () => {
    const presentation = getAlpineRecoverableProfitPresentation();
    expect(presentation.heroLabel).toBe("Recoverable Profit Opportunity");
    expect(presentation.heroAmount).toBe(ALPINE_UI_METRICS.recoverableProfitOpportunity);
    expect(presentation.heroAmount).toBeGreaterThan(500);
    expect(presentation.heroAmount).not.toBe(103);
    expect(getAlpineHeroRecommendation().title.length).toBeGreaterThan(10);
  });

  it("pins profit dashboard to Demo Provider KPIs", () => {
    const raw = computeProfitDashboard(snapshot, []);
    const pinned = applyDemoProfitDashboard(snapshot, raw);
    expect(pinned?.primary.revenue).toBe(82_450);
    expect(pinned?.primary.netProfit).toBe(16_870);
    expect(pinned?.blendedRoas?.blendedRoas30d).toBe(4.38);
  });

  it("overrides executive KPI strip from Demo Provider", () => {
    const stub: ExecutiveKpi[] = [
      { id: "revenue", label: "Revenue", value: "$99", sublabel: "x", tone: "neutral" },
      { id: "profit", label: "Estimated Profit", value: "$99", sublabel: "x", tone: "neutral" },
      { id: "cash_at_risk", label: "Cash at Risk", value: "$99", sublabel: "x", tone: "neutral" },
      { id: "inventory_risk", label: "Inventory Risk", value: "$99", sublabel: "x", tone: "neutral" },
      { id: "recovery", label: "Recovery Opportunity", value: "$99", sublabel: "x", tone: "neutral" },
    ];
    const overridden = applyDemoExecutiveKpis(snapshot, stub);
    expect(overridden.find((k) => k.id === "revenue")?.value).toMatch(/82/);
    expect(overridden.find((k) => k.id === "profit")?.value).toMatch(/17/);
    expect(overridden.find((k) => k.id === "recovery")?.value).not.toBe("$99");
  });

  it("replaces stored recommendations with curated Alpine set", () => {
    const stale = [
      {
        id: "stale-103",
        category: "slow_selling" as const,
        title: "Tiny leftover",
        severity: "low" as const,
        reason: "legacy",
        expectedImpact: "+$103/month",
        confidenceScore: 0.5,
        actionLabel: "Review",
        supportingMetrics: [],
        createdAt: new Date().toISOString(),
        status: "pending" as const,
      },
    ];
    const resolved = resolveDemoModeRecommendations(snapshot, stale);
    expect(resolved.every((r) => r.id.startsWith("ao-rec-"))).toBe(true);
    expect(resolved.some((r) => r.expectedImpact.includes("103"))).toBe(false);
    expect(resolved.length).toBe(6);
  });

  it("generateRecommendations returns only curated Alpine titles", () => {
    const recs = generateRecommendations(snapshot);
    expect(recs.some((r) => r.title.includes("Pause two underperforming Meta"))).toBe(true);
    expect(recs.some((r) => r.expectedImpact.includes("+$103"))).toBe(false);
  });

  it("hero recommendation drives Recoverable Profit Opportunity amount", () => {
    const hero = getAlpineHeroRecommendation();
    const presentation = provider!.getRecoverableProfitPresentation();
    expect(presentation.heroAmount).toBe(ALPINE_UI_METRICS.recoverableProfitOpportunity);
    expect(hero.id).toBe(ALPINE_UI_METRICS.heroRecommendationId);
    expect(presentation.heroAmount).toBeGreaterThanOrEqual(1_720);
  });
});
