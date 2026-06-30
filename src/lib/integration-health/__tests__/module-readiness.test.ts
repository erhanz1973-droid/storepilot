import { describe, expect, it } from "vitest";
import { buildModuleReadiness, overallReadinessPct } from "../module-readiness";
import type { StoreSnapshot } from "@/lib/connectors/types";
import type { ValidationGateReport } from "@/lib/recommendations/validation/types";

const gate: ValidationGateReport = {
  storeId: "test-store",
  evaluatedAt: new Date().toISOString(),
  overallMatchPercent: 90,
  canGenerateRecommendations: true,
  trustedProviderIds: ["shopify", "meta"],
  blockedProviderIds: [],
  warnedProviderIds: [],
  providers: [
    {
      providerId: "shopify",
      connectorId: "shopify",
      label: "Shopify",
      connected: true,
      matchScore: 90,
      trustLevel: "trusted",
      lastSyncAt: null,
      cacheCreatedAt: null,
      cacheAgeMinutes: null,
      dataAgeMinutes: null,
      freshness: "fresh",
      readiness: "production_ready",
    },
    {
      providerId: "meta",
      connectorId: "meta_ads",
      label: "Meta",
      connected: true,
      matchScore: 85,
      trustLevel: "trusted",
      lastSyncAt: null,
      cacheCreatedAt: null,
      cacheAgeMinutes: null,
      dataAgeMinutes: null,
      freshness: "fresh",
      readiness: "production_ready",
    },
  ],
};

const snapshot = {
  storeMetrics: { revenue30d: 5000, orders30d: 20, aov30d: 250, conversionRate30d: 2 },
  campaigns: [{ id: "c1" }],
  products: [{ inventoryQuantity: 5 }],
  dailyMetrics: Array.from({ length: 20 }, (_, i) => ({ date: `2026-01-${i + 1}`, revenue: 100 })),
  customerSnapshot: { customers: [{ id: "cust-1" }], dataTier: "full" },
} as unknown as StoreSnapshot;

describe("buildModuleReadiness", () => {
  it("returns six intelligence modules", () => {
    const modules = buildModuleReadiness({
      snapshot,
      profitDashboard: { primaryProfit: { status: "ok" } } as never,
      gate,
      overallQualityPct: 98,
    });
    expect(modules).toHaveLength(6);
    expect(modules.map((m) => m.id)).toContain("decisions");
  });

  it("computes overall readiness average", () => {
    const modules = buildModuleReadiness({
      snapshot,
      profitDashboard: { primaryProfit: { status: "ok" } } as never,
      gate,
      overallQualityPct: 98,
    });
    const pct = overallReadinessPct(modules);
    expect(pct).toBeGreaterThan(50);
    expect(pct).toBeLessThanOrEqual(100);
  });
});
