import { describe, expect, it } from "vitest";
import {
  buildDailyAiPlaybook,
  countLiveCampaignsScanned,
} from "@/lib/analytics/ai-daily-playbook";
import { buildExecutiveCeoOsLayer } from "@/lib/analytics/build-executive-ceo-os";
import type { StoreSnapshot } from "@/lib/connectors/types";
import type { DecisionItem } from "@/lib/decisions/center";
import type { ExecutiveAiBehavior } from "@/lib/analytics/executive-ai-behavior";

function shopifyOnlySnapshot(): StoreSnapshot {
  return {
    source: "connected",
    syncedAt: new Date().toISOString(),
    products: [
      {
        id: "p1",
        title: "Old Snowboard",
        inventoryQuantity: 80,
        unitsSold30d: 0,
        revenue30d: 0,
        price: 100,
        collectionIds: [],
        tags: [],
        createdAt: "2025-01-01T00:00:00.000Z",
      },
    ],
    collections: [],
    campaigns: [],
    storeMetrics: { revenue30d: 1000, orders30d: 5, aov30d: 200, conversionRate30d: 1 },
    connectorStates: {
      shopify: "connected",
      meta_ads: "disconnected",
      google_ads: "disconnected",
    },
  };
}

describe("live store without ads", () => {
  it("does not invent Google Ads playbook actions from demo growth personality", () => {
    const playbook = buildDailyAiPlaybook({ snapshot: shopifyOnlySnapshot() });
    expect(
      playbook.items.some((i) => /Increase Google Ads budget/i.test(i.title)),
    ).toBe(false);
    expect(playbook.items.some((i) => /Connect Meta or Google Ads/i.test(i.title))).toBe(true);
  });

  it("reports zero campaigns scanned when ads are disconnected", () => {
    const snapshot = shopifyOnlySnapshot();
    expect(countLiveCampaignsScanned(snapshot)).toBe(0);

    const playbook = buildDailyAiPlaybook({ snapshot });
    const decisions: DecisionItem[] = [];
    const aiBehavior = {
      liveStatus: { domains: [], overallLabel: "Healthy" },
      accountability: { items: [] },
      memory: [],
      beforeAfter: { hasMeasuredOutcomes: false },
    } as unknown as ExecutiveAiBehavior;

    const ceo = buildExecutiveCeoOsLayer({
      priorityAction: null,
      executiveFocus: {
        todayDecision: null,
        topRisks: [],
        recoveryPotentialMonthly: 0,
        businessHealth: { score: 70, label: "Healthy", href: "/analytics/health" },
      },
      dailyPlaybook: playbook,
      aiBehavior,
      decisions,
      executiveMode: {
        biggestThreat: { label: "Dead Inventory", amountMonthly: 500 },
        bestOpportunity: { label: "Dead Inventory", amountMonthly: 166 },
        estimatedProfit: 1000,
      },
      previousVisit: null,
      snapshot,
      campaignsScanned: countLiveCampaignsScanned(snapshot),
      connectedSources: {
        shopify: true,
        metaAds: false,
        googleAds: false,
        ga4: false,
        inventory: true,
        customers: true,
      },
    });

    expect(ceo.executiveBrief.findings.some((f) => /campaigns analyzed/i.test(f))).toBe(false);
    expect(ceo.executiveBrief.findings.some((f) => /Advertising leakage/i.test(f))).toBe(false);
    expect(ceo.executiveBrief.findings.some((f) => /Profit leakage identified: Dead Inventory/i.test(f))).toBe(
      true,
    );
    expect(ceo.deepAiBrief.campaignsScanned).toBe(0);
    expect(
      ceo.executiveBrief.findings.some((f) => /Increase Google Ads budget/i.test(f)),
    ).toBe(false);
  });
});
