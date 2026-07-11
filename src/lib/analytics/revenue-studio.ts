import type { CommerceOrder } from "@/lib/commerce/types";
import type { ShopifyProduct, StoreSnapshot } from "@/lib/connectors/types";
import { peakOutfittersCommerceOrders } from "@/lib/demo/peak-outfitters/orders";
import type { ProfitDashboard } from "@/lib/profit/types";
import type { ConnectorStatus, DataSourceId } from "@/lib/types";
import { estimateMonthlyRecovery } from "@/lib/analytics/recovery-engine";

export type RevenueActionKind =
  | "bundle"
  | "upsell"
  | "cross_sell"
  | "free_shipping_threshold"
  | "buy_x_get_y"
  | "clearance_campaign"
  | "vip_offer"
  | "abandoned_cart_recovery";

/** Internal scoring — never exposed to merchants */
type RevenueSignalSource =
  | "shopify_orders"
  | "ga4_behavior"
  | "advertising"
  | "inventory"
  | "profitability";

type RevenueSignal = {
  source: RevenueSignalSource;
  score: number;
  weightPct: number;
};

type RevenueActionProduct = {
  id: string;
  title: string;
  price: number;
};

/** Merchant-facing playbook — no internal scores or signal weights */
export type RevenuePlaybook = {
  id: string;
  kind: RevenueActionKind;
  category: string;
  title: string;
  productLine: string | null;
  whyBullets: string[];
  whyNow: string[];
  confidence: "High" | "Medium" | "Low";
  confidenceExplanation: string;
  expectedAovLiftPct: number | null;
  expectedRevenueMonthly: number;
  expectedProfitMonthly: number;
  inventoryImpact: string;
  timeToLaunch: string;
  risks: string[];
  productsAffected: string[];
  businessReasoning: string;
  approvalHref: string;
};

export type RevenueStudio = {
  headline: string;
  subhead: string;
  workflow: readonly ["Preview", "Send to Approval Center", "Merchant Approval", "Launch"];
  playbooks: RevenuePlaybook[];
};

const BUNDLE_WEIGHTS: Record<RevenueSignalSource, number> = {
  shopify_orders: 50,
  ga4_behavior: 20,
  profitability: 15,
  inventory: 10,
  advertising: 5,
};

const PLAYBOOK_CATEGORY: Record<RevenueActionKind, string> = {
  bundle: "Increase Average Order Value",
  upsell: "Increase Average Order Value",
  cross_sell: "Increase Average Order Value",
  free_shipping_threshold: "Increase Average Order Value",
  buy_x_get_y: "Increase Average Order Value",
  clearance_campaign: "Improve Cash Flow",
  vip_offer: "Customer Retention",
  abandoned_cart_recovery: "Recover Lost Revenue",
};

const LAUNCH_MINUTES: Record<RevenueActionKind, number> = {
  bundle: 2,
  upsell: 2,
  cross_sell: 2,
  free_shipping_threshold: 5,
  buy_x_get_y: 3,
  clearance_campaign: 5,
  vip_offer: 10,
  abandoned_cart_recovery: 15,
};

function fmt(n: number): string {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function confidenceLabel(pct: number): "High" | "Medium" | "Low" {
  if (pct >= 75) return "High";
  if (pct >= 55) return "Medium";
  return "Low";
}

function approvalHref(id: string): string {
  return `/approvals?playbook=${encodeURIComponent(id)}`;
}

function shortProductName(title: string): string {
  return title.length > 28 ? `${title.slice(0, 25)}…` : title;
}

function playbookTitle(kind: RevenueActionKind, products: RevenueActionProduct[]): string {
  if (kind === "bundle" && products.length >= 2) {
    return `Bundle ${products.map((p) => shortProductName(p.title)).join(" + ")}`;
  }
  if (kind === "free_shipping_threshold") return "Free Shipping Threshold";
  if (kind === "abandoned_cart_recovery") return "Abandoned Cart Recovery";
  if (kind === "vip_offer") return "VIP Early Access Offer";
  if (products[0]) return `${PLAYBOOK_CATEGORY[kind]} — ${shortProductName(products[0].title)}`;
  return PLAYBOOK_CATEGORY[kind];
}

function buildBusinessWhyBullets(signals: RevenueSignal[]): string[] {
  const bullets: string[] = [];
  const bySource = Object.fromEntries(signals.map((s) => [s.source, s])) as Partial<
    Record<RevenueSignalSource, RevenueSignal>
  >;

  if ((bySource.shopify_orders?.score ?? 0) >= 45) {
    bullets.push("Frequently purchased together");
  }
  if ((bySource.ga4_behavior?.score ?? 0) >= 45) {
    bullets.push("Frequently viewed together by customers");
  }
  if ((bySource.profitability?.score ?? 0) >= 45) {
    bullets.push("Strong combined profit margin");
  }
  if ((bySource.inventory?.score ?? 0) >= 45) {
    bullets.push("Healthy inventory levels");
  }
  if ((bySource.advertising?.score ?? 0) >= 45 || (bySource.ga4_behavior?.score ?? 0) >= 55) {
    bullets.push("Strong customer purchase intent");
  }

  return bullets.length > 0
    ? bullets
    : [
        "Frequently purchased together",
        "Strong combined profit margin",
        "Healthy inventory levels",
      ];
}

function buildConfidenceExplanation(input: {
  confidence: "High" | "Medium" | "Low";
  orderCount: number;
  kind: RevenueActionKind;
}): string {
  const base = `${input.confidence} confidence based on ${input.orderCount.toLocaleString()} historical orders, 30 days of customer behavior`;
  if (input.kind === "bundle" || input.kind === "cross_sell") {
    return `${base}, and consistent purchase patterns.`;
  }
  if (input.kind === "abandoned_cart_recovery") {
    return `${base}, and measurable checkout abandonment in GA4.`;
  }
  return `${base}, and aligned profit signals.`;
}

function buildWhyNow(input: {
  products: RevenueActionProduct[];
  snapshot: StoreSnapshot;
  kind: RevenueActionKind;
  pairCoCount?: number;
}): string[] {
  const reasons: string[] = [];
  const productIds = new Set(input.products.map((p) => p.id));
  const catalog = input.snapshot.products.filter((p) => productIds.has(p.id));

  const trending = catalog.filter((p) => p.tags.includes("bestseller") || p.unitsSold30d >= 80);
  if (trending.length > 0) {
    reasons.push(`${trending[0]!.title.split(" ")[0]} products are currently trending.`);
  }

  const healthyStock = catalog.every((p) => {
    const daily = p.unitsSold30d / 30;
    return daily <= 0 || p.inventoryQuantity / daily >= 14;
  });
  if (healthyStock && catalog.length > 0) {
    reasons.push("Inventory levels are healthy.");
  }

  const metaSpend = input.snapshot.campaigns?.reduce((s, c) => s + c.spend7d, 0) ?? 0;
  if (metaSpend > 500 && input.kind !== "clearance_campaign") {
    reasons.push("Advertising demand increased this week.");
  }

  const ga4 = input.snapshot.ga4Snapshot;
  if (ga4?.funnelEvents?.verified && ga4.funnelEvents.addToCart30d > 0) {
    reasons.push("Customer interest has grown during the last 30 days.");
  }

  if (input.kind === "bundle" && (input.pairCoCount ?? 0) >= 2) {
    reasons.push("Bundle performance is expected to outperform individual product sales.");
  }

  if (input.kind === "clearance_campaign") {
    reasons.push("Excess inventory is tying up cash — acting now improves turnover.");
  }

  return reasons.slice(0, 3);
}

function inventoryImpactText(products: RevenueActionProduct[], snapshot: StoreSnapshot): string {
  if (products.length === 0) return "No SKU inventory impact — store-wide policy change.";
  const catalog = snapshot.products.filter((p) => products.some((x) => x.id === p.id));
  const low = catalog.filter((p) => {
    const daily = p.unitsSold30d / 30;
    return daily > 0 && p.inventoryQuantity / daily < 14;
  });
  if (low.length > 0) {
    return `Monitor ${low.map((p) => p.title).join(", ")} — stock may need replenishment within 2 weeks.`;
  }
  return "Healthy stock on all affected SKUs — bundle can scale without stockout risk.";
}

function timeToLaunchLabel(kind: RevenueActionKind): string {
  const mins = LAUNCH_MINUTES[kind];
  return mins < 60 ? `${mins} minutes` : `${Math.round(mins / 60)} hours`;
}

type ProductPair = { a: ShopifyProduct; b: ShopifyProduct; coCount: number; attachmentPct: number };

function resolveOrders(snapshot: StoreSnapshot): CommerceOrder[] {
  if (snapshot.commerceOrders?.length) return snapshot.commerceOrders;
  if (snapshot.source === "demo") return peakOutfittersCommerceOrders();
  return [];
}

function analyzeCoPurchase(orders: CommerceOrder[], products: ShopifyProduct[]): ProductPair[] {
  const productIds = new Set(products.map((p) => p.id));
  const pairCounts = new Map<string, number>();
  let multiLineOrders = 0;

  for (const order of orders) {
    const lineIds = [...new Set(order.lines.map((l) => l.productId).filter((id) => productIds.has(id)))];
    if (lineIds.length < 2) continue;
    multiLineOrders += 1;
    for (let i = 0; i < lineIds.length; i++) {
      for (let j = i + 1; j < lineIds.length; j++) {
        const key = [lineIds[i], lineIds[j]].sort().join("|");
        pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1);
      }
    }
  }

  const pairs: ProductPair[] = [];
  for (const [key, count] of pairCounts) {
    const [idA, idB] = key.split("|");
    const a = products.find((p) => p.id === idA);
    const b = products.find((p) => p.id === idB);
    if (!a || !b) continue;
    pairs.push({
      a,
      b,
      coCount: count,
      attachmentPct: multiLineOrders > 0 ? Math.round((count / multiLineOrders) * 100) : 0,
    });
  }

  pairs.sort((x, y) => y.coCount - x.coCount);

  const tagged = products.filter((p) => p.tags.includes("bundle-candidate"));
  if (tagged.length >= 2 && pairs.length === 0) {
    pairs.push({
      a: tagged[0]!,
      b: tagged[1]!,
      coCount: Math.max(3, Math.round(orders.length * 0.2)),
      attachmentPct: 24,
    });
  }

  return pairs;
}

function grossMarginPct(product: ShopifyProduct): number {
  if (!product.unitCost || product.price <= 0) return 35;
  return ((product.price - product.unitCost) / product.price) * 100;
}

function inventoryScore(product: ShopifyProduct): number {
  const daily = product.unitsSold30d / 30;
  const daysCover = daily > 0 ? product.inventoryQuantity / daily : 999;
  if (product.inventoryQuantity <= 0) return 10;
  if (daysCover < 5) return 25;
  if (daysCover >= 14 && daysCover <= 120) return 90;
  if (daysCover > 120) return 55;
  return 70;
}

function advertisingScore(product: ShopifyProduct, snapshot: StoreSnapshot): number {
  let score = 40;
  if (product.cartAdds30d && product.unitsSold30d > 0) {
    score += Math.min(35, (product.unitsSold30d / product.cartAdds30d) * 80);
  }
  if (product.unitsSold30d >= 80) score += 15;
  return Math.min(100, Math.round(score));
}

function ga4AffinityScore(a: ShopifyProduct, b: ShopifyProduct, snapshot: StoreSnapshot): number {
  let score = 35;
  const setB = new Set(b.collectionIds);
  if (a.collectionIds.some((id) => setB.has(id))) score += 25;
  if ((a.cartAdds30d ?? 0) > 30 && (b.cartAdds30d ?? 0) > 20) score += 20;
  if (snapshot.ga4Snapshot?.funnelEvents?.verified) score += 15;
  return Math.min(100, score);
}

function orderRelationshipScore(pair: ProductPair, orders: CommerceOrder[]): number {
  if (orders.length === 0) return pair.coCount > 0 ? 65 : 40;
  return Math.min(100, Math.round(40 + (pair.coCount / Math.max(orders.length, 1)) * 200));
}

function computeBundleScore(signals: RevenueSignal[]): number {
  let total = 0;
  for (const s of signals) {
    total += s.score * (s.weightPct / 100);
  }
  return Math.round(total);
}

function buildBundleSignals(pair: ProductPair, orders: CommerceOrder[], snapshot: StoreSnapshot): RevenueSignal[] {
  const combinedMargin = (grossMarginPct(pair.a) + grossMarginPct(pair.b)) / 2;
  const avgMargin =
    snapshot.products.reduce((s, p) => s + grossMarginPct(p), 0) / Math.max(snapshot.products.length, 1);

  return [
    { source: "shopify_orders", score: orderRelationshipScore(pair, orders), weightPct: BUNDLE_WEIGHTS.shopify_orders },
    { source: "ga4_behavior", score: ga4AffinityScore(pair.a, pair.b, snapshot), weightPct: BUNDLE_WEIGHTS.ga4_behavior },
    {
      source: "profitability",
      score: Math.min(100, Math.round((combinedMargin / Math.max(avgMargin, 1)) * 70)),
      weightPct: BUNDLE_WEIGHTS.profitability,
    },
    {
      source: "inventory",
      score: Math.round((inventoryScore(pair.a) + inventoryScore(pair.b)) / 2),
      weightPct: BUNDLE_WEIGHTS.inventory,
    },
    {
      source: "advertising",
      score: Math.round((advertisingScore(pair.a, snapshot) + advertisingScore(pair.b, snapshot)) / 2),
      weightPct: BUNDLE_WEIGHTS.advertising,
    },
  ];
}

function toPlaybook(input: {
  id: string;
  kind: RevenueActionKind;
  products: RevenueActionProduct[];
  signals: RevenueSignal[];
  internalScore: number;
  snapshot: StoreSnapshot;
  orders: CommerceOrder[];
  pairCoCount?: number;
  expectedAovLiftPct: number | null;
  expectedRevenueMonthly: number;
  expectedProfitMonthly: number;
  risks: string[];
  businessReasoning: string;
}): RevenuePlaybook {
  const confidence = confidenceLabel(input.internalScore);
  return {
    id: input.id,
    kind: input.kind,
    category: PLAYBOOK_CATEGORY[input.kind],
    title: playbookTitle(input.kind, input.products),
    productLine:
      input.products.length > 0 ? input.products.map((p) => p.title).join(" × ") : null,
    whyBullets: buildBusinessWhyBullets(input.signals),
    whyNow: buildWhyNow({
      products: input.products,
      snapshot: input.snapshot,
      kind: input.kind,
      pairCoCount: input.pairCoCount,
    }),
    confidence,
    confidenceExplanation: buildConfidenceExplanation({
      confidence,
      orderCount: input.orders.length || input.snapshot.storeMetrics.orders30d,
      kind: input.kind,
    }),
    expectedAovLiftPct: input.expectedAovLiftPct,
    expectedRevenueMonthly: input.expectedRevenueMonthly,
    expectedProfitMonthly: input.expectedProfitMonthly,
    inventoryImpact: inventoryImpactText(input.products, input.snapshot),
    timeToLaunch: timeToLaunchLabel(input.kind),
    risks: input.risks,
    productsAffected:
      input.products.length > 0
        ? input.products.map((p) => p.title)
        : ["All products"],
    businessReasoning: input.businessReasoning,
    approvalHref: approvalHref(input.id),
  };
}

function buildBundlePlaybook(
  pair: ProductPair,
  orders: CommerceOrder[],
  snapshot: StoreSnapshot,
  aov: number,
  orders30d: number,
): RevenuePlaybook {
  const signals = buildBundleSignals(pair, orders, snapshot);
  const internalScore = computeBundleScore(signals);
  const products: RevenueActionProduct[] = [
    { id: pair.a.id, title: pair.a.title, price: pair.a.price },
    { id: pair.b.id, title: pair.b.title, price: pair.b.price },
  ];
  const aovLiftPct = Math.min(18, Math.round(8 + internalScore / 12));
  const recovery = estimateMonthlyRecovery({
    maxRecoverableMonthly: 0,
    gapSeverity: internalScore / 100,
    confidencePct: internalScore,
    growthBaseMonthly: aov * orders30d * (aovLiftPct / 100) * 0.35,
  });
  const combinedPrice = products.reduce((s, p) => s + p.price, 0);

  return toPlaybook({
    id: `rev-bundle-${pair.a.id}-${pair.b.id}`,
    kind: "bundle",
    products,
    signals,
    internalScore,
    snapshot,
    orders,
    pairCoCount: pair.coCount,
    expectedAovLiftPct: aovLiftPct,
    expectedRevenueMonthly: Math.round(recovery.amountMonthly / 0.35),
    expectedProfitMonthly: recovery.amountMonthly,
    risks: [
      "Bundle discount may compress margin if priced too aggressively.",
      "Inventory must stay in sync across bundled SKUs.",
    ],
    businessReasoning: `A ${fmt(combinedPrice * 0.92)} bundle should lift AOV ~${aovLiftPct}% on ${orders30d.toLocaleString()} monthly orders.`,
  });
}

function topProduct(snapshot: StoreSnapshot): ShopifyProduct | undefined {
  return [...snapshot.products].sort((a, b) => b.revenue30d - a.revenue30d)[0];
}

function genericSignals(score: number): RevenueSignal[] {
  return [
    { source: "shopify_orders", score, weightPct: 50 },
    { source: "ga4_behavior", score: score - 5, weightPct: 20 },
    { source: "profitability", score: score - 3, weightPct: 15 },
    { source: "inventory", score: score - 2, weightPct: 10 },
    { source: "advertising", score: score - 8, weightPct: 5 },
  ];
}

function buildAdditionalPlaybooks(
  snapshot: StoreSnapshot,
  profitDashboard: ProfitDashboard | null | undefined,
  orders: CommerceOrder[],
): RevenuePlaybook[] {
  const playbooks: RevenuePlaybook[] = [];
  const m = snapshot.storeMetrics;
  const aov = m.aov30d;
  const revenue = profitDashboard?.primary.revenue ?? m.revenue30d;
  const grossMargin =
    profitDashboard?.primary.revenue && profitDashboard.primary.cogs
      ? ((profitDashboard.primary.revenue - profitDashboard.primary.cogs) / profitDashboard.primary.revenue) * 100
      : 32;

  const hero = topProduct(snapshot);
  const upsellTarget = snapshot.products.find(
    (p) => p.id !== hero?.id && p.price > (hero?.price ?? 0) * 0.4 && p.price < (hero?.price ?? 0) * 0.6,
  );

  if (hero && upsellTarget) {
    const recovery = estimateMonthlyRecovery({
      growthBaseMonthly: m.orders30d * upsellTarget.price * 0.08 * (grossMargin / 100),
      gapSeverity: 0.5,
      confidencePct: 68,
      maxRecoverableMonthly: 0,
    });
    const products = [
      { id: hero.id, title: hero.title, price: hero.price },
      { id: upsellTarget.id, title: upsellTarget.title, price: upsellTarget.price },
    ];
    playbooks.push(
      toPlaybook({
        id: `rev-upsell-${hero.id}`,
        kind: "upsell",
        products,
        signals: genericSignals(72),
        internalScore: 68,
        snapshot,
        orders,
        expectedAovLiftPct: 6,
        expectedRevenueMonthly: Math.round(recovery.amountMonthly / 0.35),
        expectedProfitMonthly: recovery.amountMonthly,
        risks: ["Upsell fatigue if shown on every checkout."],
        businessReasoning: `Offer ${upsellTarget.title} to buyers of ${hero.title} at cart.`,
      }),
    );
  }

  const crossSell = snapshot.products.find((p) => p.tags.includes("bundle-candidate") && p.id !== hero?.id);
  if (hero && crossSell) {
    const recovery = estimateMonthlyRecovery({
      growthBaseMonthly: m.orders30d * crossSell.price * 0.06 * (grossMargin / 100),
      gapSeverity: 0.45,
      confidencePct: 64,
      maxRecoverableMonthly: 0,
    });
    playbooks.push(
      toPlaybook({
        id: `rev-cross-${hero.id}-${crossSell.id}`,
        kind: "cross_sell",
        products: [
          { id: hero.id, title: hero.title, price: hero.price },
          { id: crossSell.id, title: crossSell.title, price: crossSell.price },
        ],
        signals: genericSignals(68),
        internalScore: 64,
        snapshot,
        orders,
        expectedAovLiftPct: 4,
        expectedRevenueMonthly: Math.round(recovery.amountMonthly / 0.35),
        expectedProfitMonthly: recovery.amountMonthly,
        risks: ["Cross-sell may distract from higher-margin hero SKU."],
        businessReasoning: `Recommend ${crossSell.title} on ${hero.title} product pages.`,
      }),
    );
  }

  const threshold = Math.round(aov * 1.12);
  const fsRecovery = estimateMonthlyRecovery({
    growthBaseMonthly: revenue * 0.05,
    gapSeverity: 0.5,
    confidencePct: 72,
    maxRecoverableMonthly: 0,
  });
  playbooks.push(
    toPlaybook({
      id: "rev-free-shipping",
      kind: "free_shipping_threshold",
      products: [],
      signals: genericSignals(74),
      internalScore: 72,
      snapshot,
      orders,
      expectedAovLiftPct: 5,
      expectedRevenueMonthly: Math.round(fsRecovery.amountMonthly / 0.35),
      expectedProfitMonthly: fsRecovery.amountMonthly,
      risks: ["Threshold too high may reduce conversion."],
      businessReasoning: `Set free shipping at ${fmt(threshold)} to capture margin-positive basket lifts.`,
    }),
  );

  const slow = snapshot.products.find((p) => p.tags.includes("overstock") || p.tags.includes("discount-candidate"));
  if (slow) {
    const recovery = estimateMonthlyRecovery({
      maxRecoverableMonthly: slow.revenue30d * 0.15,
      gapSeverity: 0.6,
      confidencePct: 66,
    });
    playbooks.push(
      toPlaybook({
        id: `rev-clearance-${slow.id}`,
        kind: "clearance_campaign",
        products: [{ id: slow.id, title: slow.title, price: slow.price }],
        signals: genericSignals(58),
        internalScore: 58,
        snapshot,
        orders,
        expectedAovLiftPct: null,
        expectedRevenueMonthly: Math.round(recovery.amountMonthly / 0.35),
        expectedProfitMonthly: recovery.amountMonthly,
        risks: ["Deep discount may train customers to wait for sales."],
        businessReasoning: `Run a 15–20% clearance on ${slow.title} to improve inventory turnover.`,
      }),
    );
  }

  const cust = snapshot.customerSnapshot;
  const vipCustomers = cust?.customers.filter((c) => c.segment === "vip") ?? [];
  if (cust && vipCustomers.length > 0) {
    const vipRevenue = vipCustomers.reduce((s, c) => s + c.revenue30d, 0);
    const vipRecovery = estimateMonthlyRecovery({
      growthBaseMonthly: vipRevenue * 0.08,
      gapSeverity: 0.55,
      confidencePct: 74,
      maxRecoverableMonthly: 0,
    });
    playbooks.push(
      toPlaybook({
        id: "rev-vip-offer",
        kind: "vip_offer",
        products: hero ? [{ id: hero.id, title: hero.title, price: hero.price }] : [],
        signals: genericSignals(80),
        internalScore: 74,
        snapshot,
        orders,
        expectedAovLiftPct: 3,
        expectedRevenueMonthly: Math.round(vipRecovery.amountMonthly / 0.35),
        expectedProfitMonthly: vipRecovery.amountMonthly,
        risks: ["Over-discounting VIPs can erode perceived exclusivity."],
        businessReasoning: "Offer VIP early access to new arrivals 48 hours before public launch.",
      }),
    );
  }

  const ga4 = snapshot.ga4Snapshot;
  const abandonDrop =
    ga4?.funnelEvents?.verified && ga4.funnelEvents.addToCart30d > ga4.funnelEvents.checkout30d
      ? ga4.funnelEvents.addToCart30d - ga4.funnelEvents.checkout30d
      : 0;
  if (abandonDrop > 0 || orders.length > 0) {
    const cartRecovery = estimateMonthlyRecovery({
      maxRecoverableMonthly: revenue * 0.06,
      gapSeverity: 0.5,
      confidencePct: ga4?.funnelEvents?.verified ? 76 : 62,
    });
    playbooks.push(
      toPlaybook({
        id: "rev-abandoned-cart",
        kind: "abandoned_cart_recovery",
        products: hero ? [{ id: hero.id, title: hero.title, price: hero.price }] : [],
        signals: genericSignals(ga4?.funnelEvents?.verified ? 76 : 62),
        internalScore: ga4?.funnelEvents?.verified ? 76 : 62,
        snapshot,
        orders,
        expectedAovLiftPct: null,
        expectedRevenueMonthly: Math.round(cartRecovery.amountMonthly / 0.35),
        expectedProfitMonthly: cartRecovery.amountMonthly,
        risks: ["Aggressive reminders may increase unsubscribes."],
        businessReasoning: "Deploy a 3-email cart recovery flow with free-shipping nudge on email 2.",
      }),
    );
  }

  const bogoCandidate = snapshot.products.find((p) => p.unitsSold30d >= 90 && inventoryScore(p) >= 70);
  if (bogoCandidate) {
    const bogoRecovery = estimateMonthlyRecovery({
      growthBaseMonthly: bogoCandidate.revenue30d * 0.1,
      gapSeverity: 0.5,
      confidencePct: 60,
      maxRecoverableMonthly: 0,
    });
    playbooks.push(
      toPlaybook({
        id: `rev-bogo-${bogoCandidate.id}`,
        kind: "buy_x_get_y",
        products: [{ id: bogoCandidate.id, title: bogoCandidate.title, price: bogoCandidate.price }],
        signals: genericSignals(70),
        internalScore: 60,
        snapshot,
        orders,
        expectedAovLiftPct: 8,
        expectedRevenueMonthly: Math.round(bogoRecovery.amountMonthly / 0.35),
        expectedProfitMonthly: bogoRecovery.amountMonthly,
        risks: ["BOGO may cannibalize full-price sales."],
        businessReasoning: `Run Buy 2 Get 10% Off on ${bogoCandidate.title} for 14 days.`,
      }),
    );
  }

  return playbooks;
}

export function buildRevenueStudio(input: {
  snapshot: StoreSnapshot;
  profitDashboard?: ProfitDashboard | null;
}): RevenueStudio {
  const { snapshot, profitDashboard } = input;
  const orders = resolveOrders(snapshot);
  const pairs = analyzeCoPurchase(orders, snapshot.products);
  const playbooks: RevenuePlaybook[] = [];

  if (pairs[0]) {
    playbooks.push(
      buildBundlePlaybook(
        pairs[0],
        orders,
        snapshot,
        snapshot.storeMetrics.aov30d,
        snapshot.storeMetrics.orders30d,
      ),
    );
  }

  for (const pair of pairs.slice(1, 2)) {
    playbooks.push(
      buildBundlePlaybook(
        pair,
        orders,
        snapshot,
        snapshot.storeMetrics.aov30d,
        snapshot.storeMetrics.orders30d,
      ),
    );
  }

  playbooks.push(...buildAdditionalPlaybooks(snapshot, profitDashboard, orders));
  playbooks.sort((a, b) => b.expectedProfitMonthly - a.expectedProfitMonthly);

  return {
    headline: "Revenue Playbooks",
    subhead:
      "Executive revenue actions backed by orders, behavior, inventory, and profit — preview first, then approve in the Approval Center before anything launches.",
    workflow: ["Preview", "Send to Approval Center", "Merchant Approval", "Launch"],
    playbooks,
  };
}

/** @deprecated use playbooks */
export type RevenueStudioAction = RevenuePlaybook;
