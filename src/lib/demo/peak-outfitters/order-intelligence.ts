import type { CommerceCustomer, CommerceOrder } from "@/lib/commerce/types";
import type { CustomerSnapshot } from "@/lib/customers/types";
import { PEAK_OUTFITTERS } from "./constants";
import { PEAK_OUTFITTERS_PRODUCTS } from "./products";

const PLATFORM = "shopify" as const;

export type PeakOrderChannel =
  | "meta_ads"
  | "google_ads"
  | "organic_search"
  | "direct"
  | "email";

export type PeakOrderIntelSeed = {
  id: string;
  externalId: string;
  createdAt: string;
  customerName: string;
  customerEmail: string;
  channel: PeakOrderChannel;
  channelLabel: string;
  isNewCustomer: boolean;
  isReturning: boolean;
  isVip: boolean;
  isBundle: boolean;
  lifetimeValue: number;
  refundRisk: "Low" | "Medium" | "High";
  revenue: number;
  productCost: number;
  advertisingCost: number;
  shipping: number;
  paymentFees: number;
  discounts: number;
  refunds: number;
  lines: CommerceOrder["lines"];
};

const CHANNEL_LABELS: Record<PeakOrderChannel, string> = {
  meta_ads: "Meta Ads",
  google_ads: "Google Ads",
  organic_search: "Organic Search",
  direct: "Direct",
  email: "Email",
};

function daysAgo(days: number, hour = 10): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour + (days % 8), (days * 7) % 60, 0, 0);
  return d.toISOString();
}

function netProfit(seed: Pick<
  PeakOrderIntelSeed,
  "revenue" | "productCost" | "advertisingCost" | "shipping" | "paymentFees" | "discounts" | "refunds"
>): number {
  return Math.round(
    (seed.revenue -
      seed.productCost -
      seed.advertisingCost -
      seed.shipping -
      seed.paymentFees -
      seed.discounts -
      seed.refunds) *
      100,
  ) / 100;
}

function marginPct(revenue: number, profit: number): number {
  if (revenue <= 0) return 0;
  return Math.round((profit / revenue) * 1000) / 10;
}

function pickProduct(index: number) {
  const pool = PEAK_OUTFITTERS_PRODUCTS.filter((p) => p.unitsSold30d > 0);
  return pool[index % pool.length]!;
}

function buildLines(primaryIdx: number, bundle: boolean): CommerceOrder["lines"] {
  const primary = pickProduct(primaryIdx);
  const lines: CommerceOrder["lines"] = [
    {
      productId: primary.id,
      title: primary.title,
      quantity: 1,
      revenue: primary.price,
      unitCost: primary.unitCost,
    },
  ];
  if (bundle) {
    const secondary = pickProduct(primaryIdx + 4);
    lines.push({
      productId: secondary.id,
      title: secondary.title,
      quantity: 1,
      revenue: secondary.price,
      unitCost: secondary.unitCost,
    });
  }
  return lines;
}

/** 20 demo orders — 30% highly profitable, 40% profitable, 20% break-even, 10% losing */
export function peakOutfittersOrderIntelligenceSeeds(): PeakOrderIntelSeed[] {
  type Tier = "highly_profitable" | "profitable" | "break_even" | "losing";
  const names = [
    ["Alex Chen", "alex.chen@email.com"],
    ["Jordan Martinez", "jordan.m@email.com"],
    ["Taylor Johnson", "taylor.j@email.com"],
    ["Morgan Williams", "morgan.w@email.com"],
    ["Casey Brown", "casey.b@email.com"],
    ["Riley Davis", "riley.d@email.com"],
    ["Jamie Miller", "jamie.m@email.com"],
    ["Quinn Wilson", "quinn.w@email.com"],
    ["Avery Moore", "avery.m@email.com"],
    ["Blake Taylor", "blake.t@email.com"],
    ["Harper Anderson", "harper.a@email.com"],
    ["Sage Thomas", "sage.t@email.com"],
    ["Rowan Jackson", "rowan.j@email.com"],
    ["Skyler White", "skyler.w@email.com"],
    ["Reese Harris", "reese.h@email.com"],
    ["Parker Clark", "parker.c@email.com"],
    ["Dakota Lewis", "dakota.l@email.com"],
    ["Emery Walker", "emery.w@email.com"],
    ["Finley Hall", "finley.h@email.com"],
    ["Cameron Young", "cameron.y@email.com"],
  ] as const;

  const tiers: Array<{ tier: Tier; targetMarginPct: number }> = [
    { tier: "highly_profitable", targetMarginPct: 42 },
    { tier: "highly_profitable", targetMarginPct: 38 },
    { tier: "highly_profitable", targetMarginPct: 45 },
    { tier: "highly_profitable", targetMarginPct: 36 },
    { tier: "highly_profitable", targetMarginPct: 40 },
    { tier: "highly_profitable", targetMarginPct: 44 },
    { tier: "profitable", targetMarginPct: 24 },
    { tier: "profitable", targetMarginPct: 18 },
    { tier: "profitable", targetMarginPct: 22 },
    { tier: "profitable", targetMarginPct: 16 },
    { tier: "profitable", targetMarginPct: 20 },
    { tier: "profitable", targetMarginPct: 26 },
    { tier: "profitable", targetMarginPct: 19 },
    { tier: "profitable", targetMarginPct: 21 },
    { tier: "break_even", targetMarginPct: 3 },
    { tier: "break_even", targetMarginPct: 1 },
    { tier: "break_even", targetMarginPct: -1 },
    { tier: "break_even", targetMarginPct: 4 },
    { tier: "losing", targetMarginPct: -12 },
    { tier: "losing", targetMarginPct: -28 },
  ];

  const channels: PeakOrderChannel[] = [
    "email", "direct", "google_ads", "organic_search", "direct",
    "google_ads", "email", "direct", "organic_search", "google_ads",
    "meta_ads", "meta_ads", "meta_ads", "meta_ads", "meta_ads",
    "meta_ads", "google_ads", "meta_ads", "meta_ads", "google_ads",
  ];

  const seeds: PeakOrderIntelSeed[] = [];

  for (let i = 0; i < 20; i++) {
    const { tier, targetMarginPct } = tiers[i]!;
    const channel = channels[i]!;
    const bundle = i % 5 === 0;
    const lines = buildLines(i, bundle);
    const lineRevenue = lines.reduce((s, l) => s + l.revenue, 0);
    const productCost = Math.round(lines.reduce((s, l) => s + (l.unitCost ?? l.revenue * 0.42) * l.quantity, 0));
    const discounts = i % 7 === 0 ? Math.round(lineRevenue * 0.08 * 100) / 100 : 0;
    const revenue = Math.round((lineRevenue - discounts) * 100) / 100;
    const shipping = 6.5 + (i % 4) * 1.5;
    const paymentFees = Math.round((revenue * 0.029 + 0.3) * 100) / 100;
    const refunds = i === 14 ? Math.round(revenue * 0.5 * 100) / 100 : 0;

    const targetProfit = Math.round(revenue * (targetMarginPct / 100) * 100) / 100;
    let advertisingCost = Math.round(
      (revenue - productCost - shipping - paymentFees - discounts - refunds - targetProfit) * 100,
    ) / 100;
    if (channel === "direct" || channel === "organic_search") {
      advertisingCost = Math.max(0, Math.min(advertisingCost, revenue * 0.02));
    }
    if (channel === "email") {
      advertisingCost = Math.max(0, Math.min(advertisingCost, revenue * 0.05));
    }
    advertisingCost = Math.max(0, advertisingCost);
    const [customerName, customerEmail] = names[i]!;
    const isNew = i % 10 < 4;
    const isVip = i < 4 || i === 9;
    const ltv = isVip ? 920 + i * 140 : isNew ? 0 : 180 + i * 45;

    seeds.push({
      id: `po-order-${10001 + i}`,
      externalId: `#PO-${10001 + i}`,
      createdAt: daysAgo(i % 24, 9 + (i % 10)),
      customerName,
      customerEmail,
      channel,
      channelLabel: CHANNEL_LABELS[channel],
      isNewCustomer: isNew,
      isReturning: !isNew,
      isVip,
      isBundle: bundle,
      lifetimeValue: ltv,
      refundRisk: refunds > 0 ? "High" : tier === "losing" ? "Medium" : "Low",
      revenue,
      productCost,
      advertisingCost,
      shipping,
      paymentFees,
      discounts,
      refunds,
      lines,
    });
  }

  return seeds.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export function peakOutfittersCommerceOrders(): CommerceOrder[] {
  return peakOutfittersOrderIntelligenceSeeds().map((seed) => ({
    id: seed.id,
    externalId: seed.externalId,
    platform: PLATFORM,
    createdAt: seed.createdAt,
    revenue: seed.revenue,
    cogs: seed.productCost,
    shipping: seed.shipping,
    discounts: seed.discounts,
    refunds: seed.refunds,
    isNewCustomer: seed.isNewCustomer,
    customerEmail: seed.customerEmail,
    lines: seed.lines,
  }));
}

export function peakOutfittersCommerceCustomers(
  customerSnapshot?: CustomerSnapshot | null,
): CommerceCustomer[] {
  if (customerSnapshot?.customers.length) {
    return customerSnapshot.customers.slice(0, 50).map((c) => ({
      id: c.id,
      externalId: c.id,
      platform: PLATFORM,
      email: c.email,
      ordersCount: c.ordersCount,
      totalSpent: c.lifetimeRevenue,
      isReturning: c.ordersCount > 1,
    }));
  }

  return peakOutfittersOrderIntelligenceSeeds()
    .slice(0, 20)
    .map((seed, index) => ({
      id: `po-cust-${index + 1}`,
      externalId: `po-cust-${index + 1}`,
      platform: PLATFORM,
      email: seed.customerEmail,
      ordersCount: seed.isReturning ? 2 + (index % 4) : 1,
      totalSpent: seed.lifetimeValue,
      isReturning: seed.isReturning,
    }));
}

export function peakOutfittersOrderProfitTotals(): {
  revenue: number;
  netProfit: number;
  avgMarginPct: number;
} {
  const seeds = peakOutfittersOrderIntelligenceSeeds();
  const revenue = seeds.reduce((s, o) => s + o.revenue, 0);
  const totalNetProfit = seeds.reduce((s, o) => s + netProfit(o), 0);
  return {
    revenue,
    netProfit: totalNetProfit,
    avgMarginPct: marginPct(revenue, totalNetProfit),
  };
}

export { netProfit as peakOrderNetProfit, marginPct as peakOrderMarginPct };
