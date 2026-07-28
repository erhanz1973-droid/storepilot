import { describe, expect, it } from "vitest";
import {
  adsCampaignDataAvailable,
  applyCoverageConfidencePenalty,
  buildBusinessCoverage,
  canEmitAsRecommendation,
  filterPlaybookTitlesForDataAvailability,
  groundRecommendationEvidence,
  requiresUnavailableAdvertisingData,
} from "@/lib/analytics/data-availability";
import { buildDailyAiPlaybook } from "@/lib/analytics/ai-daily-playbook";
import type { StoreSnapshot } from "@/lib/connectors/types";

describe("data availability layer", () => {
  const shopifyOnly = {
    shopify: true,
    metaAds: false,
    googleAds: false,
    ga4: false,
    inventory: true,
    customers: true,
  };

  it("blocks advertising recommendations without ads connectors", () => {
    expect(adsCampaignDataAvailable(shopifyOnly)).toBe(false);
    expect(canEmitAsRecommendation("Increase Google Ads budget on winning campaigns", shopifyOnly)).toBe(
      false,
    );
    expect(canEmitAsRecommendation("Dead inventory", shopifyOnly)).toBe(true);
    expect(requiresUnavailableAdvertisingData("Advertising leakage identified", shopifyOnly)).toBe(true);
  });

  it("allows advertising recommendations when an ads connector exists", () => {
    const withMeta = { ...shopifyOnly, metaAds: true };
    expect(canEmitAsRecommendation("Reduce Meta budget on Prospecting", withMeta)).toBe(true);
    expect(canEmitAsRecommendation("Increase Google Ads budget on winning campaigns", withMeta)).toBe(
      true,
    );
  });

  it("computes business coverage and confidence penalty", () => {
    const coverage = buildBusinessCoverage(shopifyOnly);
    expect(coverage.scorePct).toBe(50);
    expect(coverage.missing.map((m) => m.label)).toEqual(
      expect.arrayContaining(["Meta Ads", "Google Ads", "GA4"]),
    );
    expect(coverage.confidenceLimitation).toMatch(/Limited by missing/);

    const adjusted = applyCoverageConfidencePenalty(72, coverage);
    expect(adjusted.confidencePct).toBeLessThan(72);
    expect(adjusted.limitation).toMatch(/Limited by missing/);
  });

  it("grounds recommendations as hypothesis or insufficient when evidence is weak (Rule 8)", () => {
    const insufficient = groundRecommendationEvidence({
      title: "Increase Google Ads budget on winning campaigns",
      sources: shopifyOnly,
      evidencePointCount: 3,
      confidencePct: 90,
    });
    expect(insufficient.standing).toBe("insufficient_data");
    expect(insufficient.explanation).toMatch(/connect/i);

    const hypothesis = groundRecommendationEvidence({
      title: "Dead inventory",
      sources: shopifyOnly,
      evidencePointCount: 0,
      confidencePct: 40,
    });
    expect(hypothesis.standing).toBe("hypothesis");
    expect(hypothesis.label).toBe("Hypothesis");
    expect(hypothesis.supportedBy).toEqual(expect.arrayContaining(["Shopify", "Inventory"]));
    expect(hypothesis.explanation).not.toMatch(/Shopify/);
    expect(hypothesis.explanation).toMatch(/confidence/i);

    const strong = groundRecommendationEvidence({
      title: "Dead inventory",
      sources: shopifyOnly,
      evidencePointCount: 3,
      confidencePct: 80,
    });
    expect(strong.standing).toBe("recommendation");
    expect(strong.explanation).toBe("");
    expect(strong.supportedBy).toEqual(expect.arrayContaining(["Shopify", "Inventory"]));
  });

  it("grounds Connect Customer Data without claiming Customers is connected", () => {
    const noCustomers = { ...shopifyOnly, customers: false };
    const grounded = groundRecommendationEvidence({
      title: "Connect Customer Data",
      sources: noCustomers,
      evidencePointCount: 1,
      confidencePct: 80,
    });
    expect(grounded.standing).toBe("recommendation");
    expect(grounded.supportedBy).toEqual(["Shopify"]);
    expect(grounded.supportedBy).not.toContain("Customers");
  });

  it("does not emit Connect Customer Data when customers are already connected", () => {
    const filtered = filterPlaybookTitlesForDataAvailability(
      [
        { title: "Connect Customer Data", module: "connections" },
        { title: "Re-engage inactive customers", module: "customers" },
      ],
      { ...shopifyOnly, customers: true },
    );
    expect(filtered.map((i) => i.title)).toEqual(["Re-engage inactive customers"]);
  });
});

describe("Connect Customer Data playbook consistency", () => {
  const baseSnapshot = {
    source: "shopify" as const,
    syncedAt: new Date().toISOString(),
    products: [],
    collections: [],
    campaigns: [],
    storeMetrics: {
      revenue30d: 1000,
      orders30d: 10,
      aov30d: 100,
      conversionRate30d: 2,
    },
    connectorStates: { shopify: "connected" as const },
  };

  it("emits Connect Customer Data only when customer records are missing", () => {
    const playbook = buildDailyAiPlaybook({
      snapshot: {
        ...baseSnapshot,
        customerSnapshot: {
          customers: [],
          dataTier: "aggregated_only",
          totalCustomers: 0,
          newCustomers30d: 0,
          returningCustomers30d: 0,
          aov: 0,
          storeAgeDays: 30,
        },
      } as StoreSnapshot,
    });
    expect(playbook.items.some((i) => i.title === "Connect Customer Data")).toBe(true);
    expect(playbook.items.some((i) => /re-engage|repeat purchase|vip customers/i.test(i.title))).toBe(
      false,
    );
  });

  it("replaces Connect Customer Data with retention insight when records exist", () => {
    const playbook = buildDailyAiPlaybook({
      snapshot: {
        ...baseSnapshot,
        customerSnapshot: {
          customers: [
            {
              id: "1",
              email: "a@example.com",
              name: "A",
              ordersCount: 1,
              lifetimeRevenue: 50,
              segment: "inactive",
              lastOrderAt: "2025-01-01",
            },
            {
              id: "2",
              email: "b@example.com",
              name: "B",
              ordersCount: 1,
              lifetimeRevenue: 40,
              segment: "inactive",
              lastOrderAt: "2025-01-01",
            },
            {
              id: "3",
              email: "c@example.com",
              name: "C",
              ordersCount: 5,
              lifetimeRevenue: 900,
              segment: "vip",
              lastOrderAt: "2026-07-01",
            },
            {
              id: "4",
              email: "d@example.com",
              name: "D",
              ordersCount: 4,
              lifetimeRevenue: 700,
              segment: "vip",
              lastOrderAt: "2026-07-01",
            },
            {
              id: "5",
              email: "e@example.com",
              name: "E",
              ordersCount: 6,
              lifetimeRevenue: 1100,
              segment: "vip",
              lastOrderAt: "2026-07-01",
            },
          ],
          dataTier: "record_level",
          totalCustomers: 5,
          newCustomers30d: 1,
          returningCustomers30d: 4,
          aov: 100,
          storeAgeDays: 120,
        },
      } as StoreSnapshot,
    });
    expect(playbook.items.some((i) => i.title === "Connect Customer Data")).toBe(false);
    expect(
      playbook.items.some((i) =>
        /re-engage inactive|reward vip|repeat purchase|customer segments/i.test(i.title),
      ),
    ).toBe(true);
  });
});
