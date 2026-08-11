/**
 * Read-only Growth Copilot verification against production shopify_sync_cache.
 * SELECT only — never writes, never syncs Shopify, never touches ads.
 *
 *   node --env-file=.env.local scripts/verify-growth-copilot-snapshots.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

async function loadTs() {
  const { register } = await import("node:module");
  try {
    register("tsx/esm", import.meta.url);
  } catch {
    // tsx already hooked via npx tsx
  }
}

function approx(a, b, eps) {
  return Math.abs(Number(a) - Number(b)) <= eps;
}

function hydrateSnapshot(raw) {
  if (!raw || typeof raw !== "object") return null;
  return {
    source: raw.source ?? "connected",
    syncedAt: raw.syncedAt ?? new Date().toISOString(),
    products: raw.products ?? [],
    collections: raw.collections ?? [],
    campaigns: raw.campaigns ?? [],
    storeMetrics: raw.storeMetrics ?? {
      revenue30d: 0,
      orders30d: 0,
      aov30d: 0,
      conversionRate30d: 0,
    },
    connectorStates: raw.connectorStates ?? { shopify: "connected" },
    ...raw,
    products: raw.products ?? [],
    collections: raw.collections ?? [],
    campaigns: raw.campaigns ?? [],
  };
}

function metrics(snapshot) {
  const products = snapshot?.products?.length ?? 0;
  const orders =
    snapshot?.commerceOrders?.length ?? snapshot?.storeMetrics?.orders30d ?? 0;
  const revenueFromOrders = (snapshot?.commerceOrders ?? []).reduce(
    (sum, o) => sum + (o.revenue ?? 0),
    0,
  );
  const revenue =
    revenueFromOrders > 0 ? revenueFromOrders : snapshot?.storeMetrics?.revenue30d ?? 0;
  return { products, orders, revenue };
}

function matchVeylo(name, m) {
  const n = (name ?? "").toLowerCase();
  if (n.includes("veylo")) return true;
  return m.products === 9 && m.orders === 2 && approx(m.revenue, 23.98, 0.05);
}

function matchAuraGrid(name, m) {
  const n = (name ?? "").toLowerCase();
  if (n.includes("auragrid") || n.includes("aura grid")) return true;
  return m.products === 28 && m.orders === 0;
}

function growingSnapshot() {
  return {
    source: "connected",
    syncedAt: new Date().toISOString(),
    products: Array.from({ length: 20 }, (_, i) => ({
      id: `g${i}`,
      title: `Growing ${i}`,
      inventoryQuantity: 10,
      unitsSold30d: 4,
      revenue30d: 200,
      price: 50,
      collectionIds: [],
      tags: [],
      imageUrl: `https://cdn.example/g${i}.jpg`,
      description: "Full product description with materials, fit, and shipping details for shoppers.",
      descriptionLength: 90,
    })),
    collections: [],
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
    storeMetrics: { revenue30d: 8000, orders30d: 40, aov30d: 200, conversionRate30d: 2.1 },
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
  };
}

function establishedSnapshot() {
  return {
    source: "connected",
    syncedAt: new Date().toISOString(),
    products: Array.from({ length: 90 }, (_, i) => ({
      id: `e${i}`,
      title: `Established ${i}`,
      inventoryQuantity: 20,
      unitsSold30d: 12,
      revenue30d: 360,
      price: 40,
      unitCost: 8,
      collectionIds: [],
      tags: [],
      imageUrl: `https://cdn.example/e${i}.jpg`,
      description: "Established catalog SKU with complete copy, care notes, and sizing for repeat buyers.",
      descriptionLength: 92,
    })),
    collections: [],
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
    storeMetrics: { revenue30d: 25000, orders30d: 150, aov30d: 166, conversionRate30d: 2.8 },
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
  };
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: installs, error: installError } = await supabase
    .from("shopify_installations")
    .select("store_id, shop_domain, shop_name, status")
    .eq("status", "active");
  if (installError) {
    console.error(JSON.stringify({ ok: false, error: installError.message }));
    process.exit(1);
  }

  const { data: caches, error: cacheError } = await supabase
    .from("shopify_sync_cache")
    .select("store_id, synced_at, snapshot");
  if (cacheError) {
    console.error(JSON.stringify({ ok: false, error: cacheError.message }));
    process.exit(1);
  }

  const cacheByStore = new Map((caches ?? []).map((row) => [row.store_id, row]));
  const catalog = (installs ?? []).map((inst) => {
    const cache = cacheByStore.get(inst.store_id);
    const snapshot = hydrateSnapshot(cache?.snapshot ?? null);
    const m = metrics(snapshot);
    return {
      storeId: inst.store_id,
      shopDomain: inst.shop_domain,
      shopName: inst.shop_name,
      syncedAt: cache?.synced_at ?? null,
      ...m,
      snapshot,
    };
  });

  const veylo = catalog.find((row) => matchVeylo(row.shopName ?? row.shopDomain, row));
  const aura = catalog.find((row) => matchAuraGrid(row.shopName ?? row.shopDomain, row));

  const { buildGrowthCopilotView, shouldLandOnGrowthCopilot, classifyMerchantStage } =
    await import("../src/lib/growth-copilot/index.ts");
  const { assembleFirstRunAnalyzeResult } = await import("../src/lib/first-run/assemble.ts");
  const { generatedEventsForAnalyzeResult } = await import("../src/lib/analytics/activation-events.ts");

  function evaluate(label, expected, snapshot) {
    if (!snapshot) {
      return { label, found: false, pass: false, reason: "snapshot_not_found" };
    }
    try {
    const view = buildGrowthCopilotView({
      storeId: expected.storeId ?? label,
      snapshot,
      recommendations: [
        {
          id: "fake-roas",
          category: "campaign_review",
          title: "Increase budget — blended ROAS is 4.2x",
          severity: "high",
          reason: "Profitability looks strong",
          expectedImpact: "$1,200/mo",
          confidenceScore: 0.9,
          actionLabel: "Scale",
          supportingMetrics: [],
          createdAt: new Date().toISOString(),
        },
      ],
    });
    const assembled = assembleFirstRunAnalyzeResult({
      storeId: expected.storeId ?? label,
      shopifyConnected: true,
      snapshot,
      recommendations: [],
      hasProfit: false,
      durationMs: 1,
    });
    const events = generatedEventsForAnalyzeResult(assembled).map((e) => e.event);
    const m = metrics(snapshot);
    const checks = {
      newStore: view.maturity.stage === "new",
      experienceGuideMe: view.maturity.experience === "guide_me",
      homeIsCopilot: shouldLandOnGrowthCopilot(view.maturity.stage) === true,
      profitabilityLocked: view.checklist.find((s) => s.id === "profitability")?.status === "locked",
      noFakeRoasEngine: !view.engineRecommendations.some((r) => /ROAS/i.test(r.title)),
      hasNba: Boolean(view.nextBestAction?.title && view.nextBestAction?.ctaHref),
      basedOnShown: /Based on:/i.test(view.basedOn) && view.known.length > 0,
      roasUnknown: view.unknown.some((row) => /ROAS|advertising profitability|acquisition cost/i.test(row.label)),
      activationEvents:
        events.includes("first_recommendation_shown") && events.includes("next_best_action_shown"),
      products: expected.products == null || m.products === expected.products,
      orders: expected.orders == null || m.orders === expected.orders,
      revenue:
        expected.revenue == null || approx(m.revenue, expected.revenue, expected.revenueEps ?? 0.05),
    };
    if (expected.firstSaleHeadline) {
      checks.firstSaleHeadline = /first sale/i.test(view.headline);
    }
    return {
      label,
      found: true,
      shopName: expected.shopName,
      shopDomain: expected.shopDomain,
      metrics: m,
      stage: view.maturity.stage,
      experience: view.maturity.experience,
      headline: view.headline,
      nba: {
        id: view.nextBestAction.id,
        title: view.nextBestAction.title,
        cta: view.nextBestAction.ctaLabel,
      },
      basedOn: view.basedOn,
      unknown: view.unknown.map((u) => u.label),
      events,
      checks,
      pass: Object.values(checks).every(Boolean),
    };
    } catch (error) {
      return {
        label,
        found: true,
        pass: false,
        reason: error instanceof Error ? error.message : String(error),
      };
    }
  }

  const growing = classifyMerchantStage({ snapshot: growingSnapshot() });
  const established = classifyMerchantStage({
    snapshot: establishedSnapshot(),
    hasProductCosts: true,
  });

  const report = {
    ok: true,
    mode: "read_only_select",
    wrote: false,
    catalogSize: catalog.length,
    catalogPreview: catalog.map((row) => ({
      shopName: row.shopName,
      shopDomain: row.shopDomain,
      products: row.products,
      orders: row.orders,
      revenue: row.revenue,
    })),
    veylo: evaluate("VEYLO", {
      storeId: veylo?.storeId,
      shopName: veylo?.shopName,
      shopDomain: veylo?.shopDomain,
      products: 9,
      orders: 2,
      revenue: 23.98,
    }, veylo?.snapshot ?? null),
    auraGrid: evaluate("AuraGrid", {
      storeId: aura?.storeId,
      shopName: aura?.shopName,
      shopDomain: aura?.shopDomain,
      products: 28,
      orders: 0,
      revenue: 0,
      firstSaleHeadline: true,
    }, aura?.snapshot ?? null),
    routing: {
      newLandsOnCopilot: shouldLandOnGrowthCopilot("new") === true,
      growingLandsOnExecutive: shouldLandOnGrowthCopilot("growing") === false,
      establishedLandsOnExecutive: shouldLandOnGrowthCopilot("established") === false,
      growingStage: growing.stage,
      establishedStage: established.stage,
    },
  };

  report.ok =
    report.veylo.pass &&
    report.auraGrid.pass &&
    report.routing.newLandsOnCopilot &&
    report.routing.growingLandsOnExecutive &&
    report.routing.establishedLandsOnExecutive &&
    report.routing.growingStage === "growing" &&
    report.routing.establishedStage === "established";

  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 2);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
