import type { CustomerRecord, CustomerSnapshot } from "@/lib/customers/types";
import { PEAK_OUTFITTERS } from "./constants";
import { PEAK_OUTFITTERS_PRODUCTS } from "./products";

const FIRST_NAMES = [
  "Alex", "Jordan", "Taylor", "Morgan", "Casey", "Riley", "Jamie", "Quinn",
  "Avery", "Blake", "Cameron", "Dakota", "Emery", "Finley", "Harper",
  "Sage", "Rowan", "Skyler", "Reese", "Parker",
];
const LAST_NAMES = [
  "Chen", "Martinez", "Johnson", "Williams", "Brown", "Davis", "Miller",
  "Wilson", "Moore", "Taylor", "Anderson", "Thomas", "Jackson", "White",
  "Harris", "Clark", "Lewis", "Walker", "Hall", "Young",
];

const REGIONS = [
  "California",
  "Colorado",
  "Oregon",
  "Washington",
  "Texas",
  "New York",
  "Utah",
  "Montana",
];
const SOURCES: CustomerRecord["acquisitionSource"][] = [
  "meta_ads",
  "google_ads",
  "organic_search",
  "direct",
  "email",
  "referral",
];

const SOURCE_LABELS: Record<string, string> = {
  meta_ads: "Meta Ads",
  google_ads: "Google Ads",
  organic_search: "Organic Search",
  direct: "Direct",
  email: "Email",
  referral: "Referral",
};

function daysAgo(d: number): string {
  const t = new Date();
  t.setDate(t.getDate() - d);
  return t.toISOString().slice(0, 10);
}

function pickSegment(
  orders: number,
  revenue: number,
  daysSince: number,
  isNew: boolean,
): CustomerRecord["segment"] {
  if (revenue >= 800 && orders >= 4) return "vip";
  if (revenue >= 500) return "high_spender";
  if (daysSince > 90) return "inactive";
  if (daysSince > 55) return "at_risk";
  if (isNew) return "new";
  if (orders === 1) return "one_time";
  return "returning";
}

function pickStatus(segment: CustomerRecord["segment"], revenueGrowth: boolean): CustomerRecord["status"] {
  if (segment === "vip") return "VIP";
  if (segment === "inactive") return "Inactive";
  if (segment === "at_risk") return "At Risk";
  if (segment === "new") return "New";
  if (revenueGrowth) return "Growing";
  return "Healthy";
}

function buildCustomer(index: number, tier: "top" | "mid" | "tail"): CustomerRecord {
  const fn = FIRST_NAMES[index % FIRST_NAMES.length]!;
  const ln = LAST_NAMES[(index * 3) % LAST_NAMES.length]!;
  const name = `${fn} ${ln}`;
  const email = `${fn.toLowerCase()}.${ln.toLowerCase()}${index}@email.com`;
  const source = SOURCES[index % SOURCES.length]!;

  const ordersCount =
    tier === "top" ? 3 + (index % 6) : tier === "mid" ? 1 + (index % 3) : 1;
  const lifetimeRevenue =
    tier === "top"
      ? 600 + (index % 8) * 180
      : tier === "mid"
        ? 120 + (index % 5) * 60
        : 45 + (index % 4) * 25;
  const revenue30d =
    tier === "top"
      ? Math.round(lifetimeRevenue * 0.35)
      : tier === "mid"
        ? Math.round(lifetimeRevenue * 0.2)
        : index % 3 === 0
          ? Math.round(lifetimeRevenue * 0.15)
          : 0;

  const daysSince =
    tier === "top"
      ? 3 + (index % 20)
      : tier === "mid"
        ? 15 + (index % 45)
        : 30 + (index % 120);
  const firstDaysAgo = daysSince + 60 + (index % 200);
  const isNew = daysSince <= 30 && ordersCount === 1;
  const segment = pickSegment(ordersCount, lifetimeRevenue, daysSince, isNew);
  const status = pickStatus(segment, tier === "top" && index % 2 === 0);

  const topProducts = PEAK_OUTFITTERS_PRODUCTS.filter((p) => p.unitsSold30d > 20)
    .sort((a, b) => b.revenue30d - a.revenue30d)
    .slice(0, 3);
  const favStart = index % Math.max(1, topProducts.length - 1);
  const favoriteProducts = topProducts.slice(favStart, favStart + 2).map((p) => ({
    productId: p.id,
    title: p.title,
    revenue: Math.round(p.price * (1 + (index % 3))),
    units: 1 + (index % 2),
  }));

  const purchaseHistory: CustomerRecord["purchaseHistory"] = [];
  for (let o = 0; o < Math.min(ordersCount, 4); o++) {
    purchaseHistory.push({
      date: daysAgo(daysSince + o * 28),
      amount: Math.round(lifetimeRevenue / ordersCount),
      itemCount: 1 + (o % 2),
      productTitles: favoriteProducts.map((f) => f.title),
    });
  }

  const hasLtvHistory = firstDaysAgo >= 90;
  const ltv = hasLtvHistory ? Math.round(lifetimeRevenue * (1.1 + (ordersCount - 1) * 0.15)) : null;
  const marginRate = 0.28;
  const totalProfit = revenue30d > 0 ? Math.round(revenue30d * marginRate) : null;

  return {
    id: `po-cust-${1000 + index}`,
    name,
    email,
    ordersCount,
    revenue30d,
    lifetimeRevenue,
    ltv,
    ltvStatus: hasLtvHistory ? (ordersCount >= 2 ? "verified" : "estimated") : "unavailable",
    aov: Math.round((lifetimeRevenue / ordersCount) * 100) / 100,
    lastPurchaseAt: daysAgo(daysSince),
    firstPurchaseAt: daysAgo(firstDaysAgo),
    segment,
    status,
    acquisitionSource: source,
    acquisitionLabel: SOURCE_LABELS[source] ?? source,
    totalProfit,
    profitStatus: totalProfit != null ? "estimated" : "unavailable",
    favoriteProducts,
    purchaseHistory,
    daysSinceLastPurchase: daysSince,
    region: REGIONS[index % REGIONS.length],
  };
}

/** Demo customer intelligence snapshot for Peak Outfitters */
export function peakOutfittersCustomerSnapshot(): CustomerSnapshot {
  const customers: CustomerRecord[] = [];
  for (let i = 0; i < 12; i++) customers.push(buildCustomer(i, "top"));
  for (let i = 12; i < 35; i++) customers.push(buildCustomer(i, "mid"));
  for (let i = 35; i < 55; i++) customers.push(buildCustomer(i, "tail"));

  const storeAgeDays = PEAK_OUTFITTERS.storeAgeMonths * 30;
  const totalCustomers = PEAK_OUTFITTERS.customerCount;
  const newCustomers30d = Math.round(totalCustomers * 0.028);
  const returningCustomers30d = Math.round(
    PEAK_OUTFITTERS.orders30d * (PEAK_OUTFITTERS.returningCustomerPct / 100) * 0.35,
  );

  const sorted = customers.sort((a, b) => b.lifetimeRevenue - a.lifetimeRevenue);

  const cohortRetention = [
    { month: "Oct 2025", cohortSize: 142, retention30d: 38, retention60d: 28, retention90d: 22 },
    { month: "Nov 2025", cohortSize: 156, retention30d: 41, retention60d: 31, retention90d: 24 },
    { month: "Dec 2025", cohortSize: 198, retention30d: 44, retention60d: 33, retention90d: 26 },
    { month: "Jan 2026", cohortSize: 168, retention30d: 39, retention60d: 29, retention90d: 0 },
    { month: "Feb 2026", cohortSize: 174, retention30d: 42, retention60d: 0, retention90d: 0 },
    { month: "Mar 2026", cohortSize: 181, retention30d: 36, retention60d: 0, retention90d: 0 },
  ];

  return {
    dataTier: "record_level" as const,
    storeAgeDays,
    orders30d: PEAK_OUTFITTERS.orders30d,
    totalCustomers,
    newCustomers30d,
    returningCustomers30d,
    repeatPurchaseRatePct:
      sorted.length > 0
        ? Math.round(
            (sorted.filter((c) => c.ordersCount >= 2).length / sorted.length) * 1000,
          ) / 10
        : 0,
    aov: PEAK_OUTFITTERS.aov,
    aovStatus: "verified" as const,
    customers: sorted,
    cohortRetention,
  };
}
