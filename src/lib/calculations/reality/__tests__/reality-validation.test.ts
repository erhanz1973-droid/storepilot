import { describe, expect, it } from "vitest";
import { calculateBusinessKPIs } from "@/lib/calculations/kpis/engine";
import { integrityRawFacts } from "@/lib/calculations/integrity/bridge";
import {
  applyRecommendationGateToConfidence,
  buildRealityValidationReport,
  realityObservationsFromIntegrityFixture,
  storePilotKpisFromBusinessKpis,
} from "@/lib/calculations/reality";
import type { RealitySourceObservation } from "@/lib/calculations/reality";

describe("Reality Validation Phase 2", () => {
  const syncedAt = "2026-07-14T10:00:00.000Z";
  const nowMs = Date.parse("2026-07-14T12:00:00.000Z");

  it("verifies Shopify revenue exactly and Meta spend within tolerance", () => {
    const kpis = calculateBusinessKPIs(integrityRawFacts());
    const storepilot = storePilotKpisFromBusinessKpis(kpis, { lastSyncedAt: syncedAt });
    const report = buildRealityValidationReport(
      storepilot,
      realityObservationsFromIntegrityFixture(syncedAt),
      { merchantId: "demo-integrity", nowMs, window: "last30d" },
    );

    const revenue = report.results.find((r) => r.kpiId === "revenue");
    expect(revenue?.status).toBe("verified");
    expect(revenue?.differencePct).toBe(0);
    expect(revenue?.trusted).toBe(true);

    const adSpend = report.results.find((r) => r.kpiId === "ad_spend");
    expect(adSpend?.status).toBe("within_tolerance");
    expect(adSpend?.differencePct).toBeGreaterThan(0);
    expect(adSpend?.differencePct).toBeLessThan(0.01);
    expect(adSpend?.reason).toMatch(/timezone/i);

    expect(report.trustScore.scorePct).toBeGreaterThan(50);
    expect(report.gate.allowHighConfidenceRecommendations).toBe(true);
  });

  it("marks missing COGS as Missing Source and profit as provisional", () => {
    const storepilot = [
      {
        kpiId: "revenue",
        label: "Revenue",
        value: 50_000,
        lastSyncedAt: syncedAt,
        critical: true,
      },
      {
        kpiId: "ad_spend",
        label: "Advertising Spend",
        value: 10_000,
        lastSyncedAt: syncedAt,
        critical: true,
      },
      {
        kpiId: "cogs",
        label: "Cost of Goods (COGS)",
        value: null,
        lastSyncedAt: syncedAt,
        profitSensitive: true,
      },
      {
        kpiId: "net_profit",
        label: "Net Profit",
        value: 8_000,
        lastSyncedAt: syncedAt,
        profitSensitive: true,
      },
    ];

    const observations: RealitySourceObservation[] = [
      {
        kpiId: "revenue",
        source: "shopify_analytics",
        value: 50_000,
        observedAt: syncedAt,
      },
      {
        kpiId: "ad_spend",
        source: "meta_ads_manager",
        value: 10_000,
        observedAt: syncedAt,
      },
      // cogs intentionally absent
    ];

    const report = buildRealityValidationReport(storepilot, observations, { nowMs });
    const cogs = report.results.find((r) => r.kpiId === "cogs");
    expect(cogs?.status).toBe("missing_source");
    expect(report.trustScore.provisionalProfitEstimates).toBe(true);
    expect(report.trustScore.unverified.some((u) => u.kpiId === "cogs")).toBe(true);
    expect(report.gate.provisionalMetrics).toContain("cogs");
    expect(report.gate.warnings.some((w) => /provisional/i.test(w))).toBe(true);
  });

  it("blocks high-confidence when critical revenue needs investigation", () => {
    const storepilot = [
      {
        kpiId: "revenue",
        label: "Revenue",
        value: 52_340,
        lastSyncedAt: syncedAt,
        critical: true,
      },
      {
        kpiId: "ad_spend",
        label: "Advertising Spend",
        value: 12_100,
        lastSyncedAt: syncedAt,
        critical: true,
      },
    ];
    const observations: RealitySourceObservation[] = [
      {
        kpiId: "revenue",
        source: "shopify_analytics",
        value: 40_000, // large unexplained gap
        observedAt: syncedAt,
      },
      {
        kpiId: "ad_spend",
        source: "meta_ads_manager",
        value: 12_100,
        observedAt: syncedAt,
      },
    ];

    const report = buildRealityValidationReport(storepilot, observations, { nowMs });
    expect(report.results.find((r) => r.kpiId === "revenue")?.status).toBe(
      "needs_investigation",
    );
    expect(report.gate.allowHighConfidenceRecommendations).toBe(false);
    expect(report.gate.blockers.length).toBeGreaterThan(0);

    const adjusted = applyRecommendationGateToConfidence(92, report.gate);
    expect(adjusted.adjustedConfidencePct).toBeLessThan(70);
    expect(adjusted.blockedHighConfidence).toBe(true);
  });

  it("treats stale sync as not trusted even when values match", () => {
    const oldSync = "2026-07-10T10:00:00.000Z"; // > 36h before nowMs
    const storepilot = [
      {
        kpiId: "revenue",
        label: "Revenue",
        value: 52_340,
        lastSyncedAt: oldSync,
        critical: true,
      },
    ];
    const observations: RealitySourceObservation[] = [
      {
        kpiId: "revenue",
        source: "shopify_analytics",
        value: 52_340,
        observedAt: oldSync,
      },
    ];
    const report = buildRealityValidationReport(storepilot, observations, { nowMs });
    const revenue = report.results.find((r) => r.kpiId === "revenue");
    expect(revenue?.status).toBe("verified");
    expect(revenue?.trusted).toBe(false);
    expect(revenue?.reason).toMatch(/stale/i);
  });
});
