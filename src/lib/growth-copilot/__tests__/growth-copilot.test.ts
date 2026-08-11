import { describe, expect, it } from "vitest";
import type { StoreSnapshot } from "@/lib/connectors/types";
import type { Recommendation } from "@/lib/types";
import { buildGrowthCopilotView } from "../build";
import { classifyMerchantStage } from "../maturity";
import { adjustDecisionPriorityForMerchantStage } from "../personalization";
import type { DecisionItem } from "@/lib/decisions/center";

function snapshot(overrides: Partial<StoreSnapshot> = {}): StoreSnapshot {
  return {
    source: "connected",
    syncedAt: new Date().toISOString(),
    products: [],
    collections: [],
    campaigns: [],
    storeMetrics: {
      revenue30d: 0,
      orders30d: 0,
      aov30d: 0,
      conversionRate30d: 0,
    },
    connectorStates: {
      shopify: "connected",
      meta_ads: "disconnected",
      google_ads: "disconnected",
      ga4: "disconnected",
    },
    ...overrides,
  };
}

function product(
  id: string,
  extra: Partial<StoreSnapshot["products"][number]> = {},
): StoreSnapshot["products"][number] {
  return {
    id,
    title: extra.title ?? `Product ${id}`,
    inventoryQuantity: extra.inventoryQuantity ?? 8,
    unitsSold30d: extra.unitsSold30d ?? 0,
    revenue30d: extra.revenue30d ?? 0,
    price: extra.price ?? 24,
    collectionIds: [],
    tags: [],
    imageUrl: extra.imageUrl,
    description: extra.description,
    descriptionLength: extra.descriptionLength,
    ...extra,
  };
}

const veylo = snapshot({
  products: [
    product("hoodie", {
      title: "Classic Hoodie",
      unitsSold30d: 2,
      revenue30d: 23.98,
      price: 11.99,
      imageUrl: "https://cdn.example/hoodie.jpg",
      description: "A warm hoodie with a front pocket, durable cuffs, and an everyday fit designed for cold mornings.",
      descriptionLength: 98,
    }),
    product("tee", {
      title: "Quiet Tee",
      price: 19,
      imageUrl: "https://cdn.example/tee.jpg",
      description: "Soft cotton tee cut for an easy everyday fit, long-lasting color, and a clean crew neckline.",
      descriptionLength: 94,
    }),
    ...Array.from({ length: 7 }, (_, i) =>
      product(`p${i}`, {
        title: `VEYLO Item ${i + 1}`,
        price: 18,
        imageUrl: `https://cdn.example/p${i}.jpg`,
        description: "Ready-to-ship accessory with clear sizing notes, care instructions, and material details included.",
        descriptionLength: 99,
      }),
    ),
  ],
  storeMetrics: { revenue30d: 23.98, orders30d: 2, aov30d: 11.99, conversionRate30d: 1 },
  commerceOrders: [
    {
      id: "o1",
      externalId: "o1",
      platform: "shopify",
      createdAt: "2026-08-01T00:00:00.000Z",
      revenue: 11.99,
      cogs: 0,
      shipping: 0,
      discounts: 0,
      refunds: 0,
      isNewCustomer: true,
      lines: [{ productId: "hoodie", title: "Classic Hoodie", quantity: 1, revenue: 11.99 }],
    },
    {
      id: "o2",
      externalId: "o2",
      platform: "shopify",
      createdAt: "2026-08-02T00:00:00.000Z",
      revenue: 11.99,
      cogs: 0,
      shipping: 0,
      discounts: 0,
      refunds: 0,
      isNewCustomer: false,
      lines: [{ productId: "hoodie", title: "Classic Hoodie", quantity: 1, revenue: 11.99 }],
    },
  ],
});

const auraGrid = snapshot({
  products: Array.from({ length: 28 }, (_, i) =>
    product(`ag-${i + 1}`, {
      title: `AuraGrid SKU ${i + 1}`,
      inventoryQuantity: i === 0 ? 5000 : 4,
      price: 40,
      imageUrl: `https://cdn.example/ag${i}.jpg`,
      description:
        "Precision-cut wall panel with mounting hardware and a matte finish designed for home offices.",
      descriptionLength: 96,
    }),
  ),
  storeMetrics: { revenue30d: 0, orders30d: 0, aov30d: 0, conversionRate30d: 0 },
});

function growingSnapshot(): StoreSnapshot {
  return snapshot({
    products: Array.from({ length: 20 }, (_, i) =>
      product(`g${i}`, {
        imageUrl: `https://cdn.example/g${i}.jpg`,
        description: "Full product description with materials, fit, and shipping details for shoppers.",
        descriptionLength: 90,
        unitsSold30d: 4,
        revenue30d: 200,
      }),
    ),
    storeMetrics: { revenue30d: 8000, orders30d: 40, aov30d: 200, conversionRate30d: 2.1 },
    campaigns: [
      {
        id: "c1",
        name: "Prospecting",
        status: "ACTIVE",
        effectiveStatus: "ACTIVE",
        metaEffectiveStatus: "ACTIVE",
        spend7d: 400,
        revenue7d: 900,
        roas7d: 2.25,
        ctr7d: 1.2,
        frequency7d: 1.4,
        impressions7d: 12000,
      },
    ],
    connectorStates: {
      shopify: "connected",
      meta_ads: "connected",
      google_ads: "connected",
      ga4: "connected",
    },
    googleAdsSnapshot: {
      campaigns: [],
      adGroups: [],
      keywords: [],
      searchTerms: [],
      rollups: {
        today: { spend: 20, attributedRevenue: 40, orders: 1 },
        yesterday: { spend: 20, attributedRevenue: 40, orders: 1 },
        last7d: { spend: 180, attributedRevenue: 400, orders: 8 },
        last30d: { spend: 700, attributedRevenue: 1600, orders: 30 },
      },
      dailySpend: [],
    },
  });
}

function establishedSnapshot(): StoreSnapshot {
  return snapshot({
    products: Array.from({ length: 90 }, (_, i) =>
      product(`e${i}`, {
        imageUrl: `https://cdn.example/e${i}.jpg`,
        description: "Established catalog SKU with complete copy, care notes, and sizing for repeat buyers.",
        descriptionLength: 92,
        unitsSold30d: 12,
        revenue30d: 360,
        unitCost: 8,
      }),
    ),
    storeMetrics: { revenue30d: 25000, orders30d: 150, aov30d: 166, conversionRate30d: 2.8 },
    campaigns: [
      {
        id: "c1",
        name: "Evergreen",
        status: "ACTIVE",
        effectiveStatus: "ACTIVE",
        metaEffectiveStatus: "ACTIVE",
        spend7d: 1200,
        revenue7d: 3600,
        roas7d: 3,
        ctr7d: 1.1,
        frequency7d: 1.8,
        impressions7d: 40000,
      },
    ],
    connectorStates: {
      shopify: "connected",
      meta_ads: "connected",
      google_ads: "connected",
      ga4: "connected",
    },
    googleAdsSnapshot: {
      campaigns: [],
      adGroups: [],
      keywords: [],
      searchTerms: [],
      rollups: {
        today: { spend: 80, attributedRevenue: 200, orders: 4 },
        yesterday: { spend: 80, attributedRevenue: 200, orders: 4 },
        last7d: { spend: 500, attributedRevenue: 1400, orders: 20 },
        last30d: { spend: 2000, attributedRevenue: 6000, orders: 70 },
      },
      dailySpend: [],
    },
  });
}

const fakeProfitRec: Recommendation = {
  id: "roas-1",
  category: "campaign_review",
  title: "Increase budget — blended ROAS is 4.2x",
  severity: "high",
  reason: "Profitability looks strong",
  expectedImpact: "$1,200/mo",
  confidenceScore: 0.9,
  actionLabel: "Scale",
  supportingMetrics: [],
  createdAt: new Date().toISOString(),
};

describe("merchant maturity", () => {
  it("Test A — 0 orders is New Store / Guide Me with no fake profitability rec", () => {
    const view = buildGrowthCopilotView({
      storeId: "a",
      snapshot: auraGrid,
      recommendations: [fakeProfitRec],
    });
    expect(view.maturity.stage).toBe("new");
    expect(view.maturity.experience).toBe("guide_me");
    expect(view.showProfitabilityDashboard).toBe(false);
    expect(view.engineRecommendations.some((r) => /ROAS/i.test(r.title))).toBe(false);
    expect(view.nextBestAction.ctaLabel).not.toMatch(/ROAS|profit/i);
    expect(view.checklist.find((s) => s.id === "profitability")?.status).toBe("locked");
  });

  it("Test B — 2 orders / low revenue is New Store with a store-specific next action", () => {
    const view = buildGrowthCopilotView({ storeId: "veylo", snapshot: veylo });
    expect(view.maturity.stage).toBe("new");
    expect(view.maturity.experience).toBe("guide_me");
    expect(view.nextBestAction.id).toBe("connect_meta");
    expect(view.nextBestAction.problem).toMatch(/advertising performance/i);
    expect(view.basedOn).toMatch(/9 products/);
    expect(view.basedOn).toMatch(/2 orders/);
    expect(view.basedOn).toMatch(/\$23\.98/);
  });

  it("Test C — meaningful orders + marketing data is Growing / Optimize", () => {
    const maturity = classifyMerchantStage({ snapshot: growingSnapshot() });
    expect(maturity.stage).toBe("growing");
    expect(maturity.experience).toBe("optimize_me");
  });

  it("Test D — large store + sufficient data is Established / Profitability", () => {
    const maturity = classifyMerchantStage({
      snapshot: establishedSnapshot(),
      hasProductCosts: true,
    });
    expect(maturity.stage).toBe("established");
    expect(maturity.experience).toBe("improve_profitability");
  });

  it("Test E — missing Meta Ads creates a marketing setup task", () => {
    const view = buildGrowthCopilotView({ storeId: "e", snapshot: veylo });
    const marketing = view.checklist.find((s) => s.id === "marketing_setup");
    expect(marketing?.complete).toBe(false);
    expect(marketing?.items.find((i) => i.id === "meta")?.status).toBe("missing");
    expect(view.nextBestAction.id).toBe("connect_meta");
    expect(view.nextBestAction.ctaHref).toContain("meta_ads");
  });

  it("Test F — incomplete product data creates a product readiness task", () => {
    const snap = snapshot({
      products: [
        product("thin", {
          title: "Thin",
          price: 20,
          imageUrl: "https://cdn.example/thin.jpg",
          description: "Too short",
          descriptionLength: 9,
        }),
        product("ok", {
          title: "Complete Product Title",
          price: 20,
          imageUrl: "https://cdn.example/ok.jpg",
          description: "A full description that explains materials, fit, and why a customer should buy this.",
          descriptionLength: 90,
        }),
      ],
    });
    const view = buildGrowthCopilotView({ storeId: "f", snapshot: snap });
    expect(view.nextBestAction.id).toBe("improve_descriptions");
    expect(view.nextBestAction.problem).toMatch(/1 of your products/);
    expect(view.checklist.find((s) => s.id === "product_readiness")?.complete).toBe(false);
  });

  it("Test G — no stronger rec still returns a useful low-data state, never blank", () => {
    const readyNew = snapshot({
      products: [
        product("ready", {
          title: "Ready Product",
          price: 32,
          imageUrl: "https://cdn.example/ready.jpg",
          description: "Complete copy covering materials, shipping, and what makes this product worth buying.",
          descriptionLength: 92,
        }),
      ],
      storeMetrics: { revenue30d: 48, orders30d: 2, aov30d: 24, conversionRate30d: 1 },
      connectorStates: {
        shopify: "connected",
        meta_ads: "connected",
        google_ads: "connected",
        ga4: "connected",
      },
      campaigns: [
        {
          id: "c1",
          name: "Test",
          status: "ACTIVE",
          effectiveStatus: "ACTIVE",
          metaEffectiveStatus: "ACTIVE",
          spend7d: 10,
          revenue7d: 0,
          roas7d: 0,
          ctr7d: 0,
          frequency7d: 1,
          impressions7d: 100,
        },
      ],
      googleAdsSnapshot: {
        campaigns: [],
        adGroups: [],
        keywords: [],
        searchTerms: [],
        rollups: {
          today: { spend: 1, attributedRevenue: 0, orders: 0 },
          yesterday: { spend: 1, attributedRevenue: 0, orders: 0 },
          last7d: { spend: 5, attributedRevenue: 0, orders: 0 },
          last30d: { spend: 20, attributedRevenue: 0, orders: 0 },
        },
        dailySpend: [],
      },
      ga4Snapshot: {
        sessions30d: 40,
        landingPages: [],
        sourceMedium: [],
        utmCampaigns: [],
        devices: [],
        countries: [],
      },
      shopProfile: {
        policies: { refund: true, privacy: true, shipping: true, terms: true },
      },
    });
    const view = buildGrowthCopilotView({ storeId: "g", snapshot: readyNew });
    expect(view.nextBestAction.title.length).toBeGreaterThan(8);
    expect(view.nextBestAction.ctaHref.length).toBeGreaterThan(1);
    expect(view.known.length).toBeGreaterThan(0);
    expect(view.checklist).toHaveLength(7);
    expect(view.showProfitabilityDashboard).toBe(false);
  });
});

describe("VEYLO and AuraGrid reference scenarios", () => {
  it("VEYLO — 9 products, 2 orders, $23.98 → New Store / Guide Me", () => {
    const view = buildGrowthCopilotView({ storeId: "veylo", snapshot: veylo });
    expect(view.maturity.productCount).toBe(9);
    expect(view.maturity.orders30d).toBe(2);
    expect(view.maturity.revenue30d).toBeCloseTo(23.98);
    expect(view.maturity.stage).toBe("new");
    expect(view.headline).toMatch(/build your store/i);
    expect(view.nextBestAction.id).toBe("connect_meta");
    expect(view.unknown.some((row) => row.label === "ROAS")).toBe(true);
    expect(view.checklist.find((s) => s.id === "first_sales")?.complete).toBe(true);
    expect(view.checklist.find((s) => s.id === "profitability")?.status).toBe("locked");
  });

  it("AuraGrid — 28 products, 0 orders → New Store, first-sale headline", () => {
    const view = buildGrowthCopilotView({ storeId: "auragrid", snapshot: auraGrid });
    expect(view.maturity.productCount).toBe(28);
    expect(view.maturity.orders30d).toBe(0);
    expect(view.maturity.stage).toBe("new");
    expect(view.headline).toMatch(/first sale/i);
    expect(view.checklist.find((s) => s.id === "first_sales")?.complete).toBe(false);
    expect(view.nextBestAction.id).toBe("connect_meta");
  });
});

describe("merchant stage personalization", () => {
  it("buries ROAS scaling recs for New stores", () => {
    const item: DecisionItem = {
      id: "d1",
      priority: "high",
      summary: "Scale Meta campaign — ROAS is above target",
      why: "Blended ROAS looks strong",
      supportingMetrics: [],
      confidencePct: 80,
      estimatedImpactLabel: "$500",
      recommendedAction: "Increase budget",
      status: "open",
      actionAvailable: false,
      executionAvailability: "manual",
      source: "recommendation",
      sourceId: "r1",
      priorityScore: 80,
    };
    expect(adjustDecisionPriorityForMerchantStage(item, "new")).toBeLessThan(0);
    expect(adjustDecisionPriorityForMerchantStage(item, "established")).toBeGreaterThan(0);
  });
});

describe("do not hallucinate", () => {
  it("does not invent description issues when description was never synced", () => {
    const snap = snapshot({
      products: [product("no-desc", { title: "Named Product", price: 20, imageUrl: "https://cdn.example/x.jpg" })],
    });
    const view = buildGrowthCopilotView({ storeId: "x", snapshot: snap });
    const desc = view.checklist
      .find((s) => s.id === "product_readiness")
      ?.items.find((i) => i.id === "descriptions");
    expect(desc?.status).toBe("unknown");
    expect(view.nextBestAction.id).not.toBe("improve_descriptions");
  });
});
