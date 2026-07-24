import { allowDemoData } from "@/lib/env/runtime";
import type { AttributionDashboard } from "@/lib/attribution/models";
import { CHANNEL_LABELS } from "@/lib/attribution/models";
import type { ChartDefinition } from "@/lib/analytics/types";
import type { CommerceOrder } from "@/lib/commerce/types";
import type { StoreSnapshot } from "@/lib/connectors/types";
import { peakOutfittersCustomerSnapshot } from "@/lib/demo/peak-outfitters/customers";
import { peakOutfittersCommerceOrders } from "@/lib/demo/peak-outfitters/orders";
import type { ProfitDashboard } from "@/lib/profit/types";
import {
  COHORT_MIN_DAYS,
  computePurchaseFrequency,
  computeRepeatPurchaseRate,
  formatCustomerCount,
  hasCustomerRecords,
  LTV_MIN_DAYS,
  metric,
  repeatBuyerCount,
} from "./metrics";
import {
  aggregateCustomersFromOrders,
  inferAggregatesFromStoreMetrics,
} from "./order-aggregates";
import type {
  CustomerAcquisitionRow,
  CustomerAiInsight,
  CustomerCohortPreview,
  CustomerDataStatus,
  CustomerDataTier,
  CustomerHealthBreakdown,
  CustomerIntelligenceAnalytics,
  CustomerLtvSummary,
  CustomerMetricMeta,
  CustomerOpportunity,
  CustomerRecord,
  CustomerRfmSegment,
  CustomerSegmentId,
  CustomerSegmentRow,
  CustomerSnapshot,
  CustomersExecutiveSummary,
} from "./types";
import { CUSTOMER_SEGMENT_LABELS } from "./types";

function normalizeSnapshot(raw: CustomerSnapshot, orders30d?: number): CustomerSnapshot {
  const dataTier: CustomerDataTier =
    raw.dataTier ?? (raw.customers.length > 0 ? "record_level" : "aggregated_only");
  return {
    ...raw,
    dataTier,
    orders30d: raw.orders30d ?? orders30d,
  };
}

function resolveCommerceOrders(snapshot: StoreSnapshot): CommerceOrder[] {
  if (snapshot.commerceOrders?.length) return snapshot.commerceOrders;
  if (allowDemoData() && snapshot.source === "demo") return peakOutfittersCommerceOrders();
  return [];
}

function storeAgeDaysFromOrders(orders: CommerceOrder[], fallback = 30): number {
  if (orders.length === 0) return fallback;
  const oldestMs = orders.reduce(
    (min, order) => Math.min(min, new Date(order.createdAt).getTime()),
    Date.now(),
  );
  return Math.max(1, Math.ceil((Date.now() - oldestMs) / 86_400_000));
}

function buildAggregatedCustomerSnapshot(snapshot: StoreSnapshot): CustomerSnapshot {
  const orders = resolveCommerceOrders(snapshot);
  const shopifyCount = snapshot.shopifyCustomersCount;
  const fromOrders = aggregateCustomersFromOrders(orders, { shopifyCustomersCount: shopifyCount });
  const agg =
    fromOrders ??
    inferAggregatesFromStoreMetrics({
      orders30d: snapshot.storeMetrics.orders30d,
      aov30d: snapshot.storeMetrics.aov30d,
      shopifyCustomersCount: shopifyCount,
    });

  const aov =
    fromOrders && fromOrders.aov30d > 0
      ? fromOrders.aov30d
      : snapshot.storeMetrics.aov30d;

  return {
    dataTier: "aggregated_only",
    storeAgeDays: storeAgeDaysFromOrders(orders),
    orders30d: snapshot.storeMetrics.orders30d,
    totalCustomers: agg.totalCustomers,
    newCustomers30d: agg.newCustomers30d,
    returningCustomers30d: agg.returningCustomers30d,
    repeatPurchaseRatePct: agg.repeatPurchaseRatePct ?? 0,
    aov,
    aovStatus: aov > 0 ? "verified" : "unavailable",
    aggregatedFromOrders: fromOrders != null,
    customers: [],
    cohortRetention: undefined,
  };
}

function resolveCustomerSnapshot(snapshot: StoreSnapshot): CustomerSnapshot | null {
  if (snapshot.customerSnapshot?.customers.length) {
    return normalizeSnapshot(snapshot.customerSnapshot, snapshot.storeMetrics.orders30d);
  }
  if (allowDemoData() && snapshot.source === "demo") return peakOutfittersCustomerSnapshot();
  if (!snapshot.storeMetrics.orders30d) return null;

  return buildAggregatedCustomerSnapshot(snapshot);
}

function buildSegments(snapshot: CustomerSnapshot): CustomerSegmentRow[] {
  const segmentIds: CustomerSegmentId[] = [
    "vip",
    "returning",
    "new",
    "one_time",
    "at_risk",
    "inactive",
    "high_spender",
  ];

  if (!hasCustomerRecords(snapshot)) {
    return segmentIds.map((id) => ({
      id,
      label: CUSTOMER_SEGMENT_LABELS[id],
      count: 0,
      countStatus: "unavailable" as CustomerDataStatus,
      revenueContribution: null,
      revenueStatus: "unavailable" as CustomerDataStatus,
      revenueNotice: "Waiting for complete customer-order sync.",
      shareOfRevenuePct: null,
    }));
  }

  const totalRev = snapshot.customers.reduce((s, c) => s + c.lifetimeRevenue, 0);

  return segmentIds.map((id) => {
    const members = snapshot.customers.filter((c) => c.segment === id);
    const revenue = members.reduce((s, c) => s + c.lifetimeRevenue, 0);
    return {
      id,
      label: CUSTOMER_SEGMENT_LABELS[id],
      count: members.length,
      countStatus: "verified" as CustomerDataStatus,
      revenueContribution: revenue,
      revenueStatus: "verified" as CustomerDataStatus,
      shareOfRevenuePct:
        totalRev > 0 ? Math.round((revenue / totalRev) * 1000) / 10 : null,
    };
  });
}

function buildAcquisition(
  snapshot: CustomerSnapshot,
  attribution: AttributionDashboard | null,
): CustomerAcquisitionRow[] {
  if (hasCustomerRecords(snapshot)) {
    const byChannel = new Map<
      string,
      { customers: number; revenue: number; ltvSum: number; ltvCount: number }
    >();
    for (const c of snapshot.customers) {
      const key = c.acquisitionSource;
      const row = byChannel.get(key) ?? { customers: 0, revenue: 0, ltvSum: 0, ltvCount: 0 };
      row.customers += 1;
      row.revenue += c.lifetimeRevenue;
      if (c.ltv != null) {
        row.ltvSum += c.ltv;
        row.ltvCount += 1;
      }
      byChannel.set(key, row);
    }
    const total = [...byChannel.values()].reduce((s, r) => s + r.customers, 0);
    return [...byChannel.entries()]
      .map(([channelId, row]) => ({
        channelId,
        label: CHANNEL_LABELS[channelId as keyof typeof CHANNEL_LABELS] ?? channelId,
        customers: row.customers,
        customersStatus: "verified" as CustomerDataStatus,
        customersDisplay: formatCustomerCount(row.customers, "verified"),
        revenue: Math.round(row.revenue),
        revenueStatus: "verified" as CustomerDataStatus,
        avgLtv: row.ltvCount > 0 ? Math.round(row.ltvSum / row.ltvCount) : null,
        ltvStatus: (row.ltvCount >= 3 ? "verified" : row.ltvCount > 0 ? "estimated" : "unavailable") as CustomerDataStatus,
        sharePct: total > 0 ? Math.round((row.customers / total) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.customers - a.customers);
  }

  if (snapshot.dataTier === "aggregated_only") {
    return [];
  }

  if (attribution) {
    return attribution.channels
      .filter((c) => c.attributedOrders > 0)
      .map((c) => {
        const customers = Math.round(c.attributedOrders);
        return {
          channelId: c.channelId,
          label: c.channelLabel,
          customers,
          customersStatus: "estimated" as CustomerDataStatus,
          customersDisplay: formatCustomerCount(customers, "estimated"),
          revenue: Math.round(c.attributedRevenue),
          revenueStatus: "estimated" as CustomerDataStatus,
          avgLtv: null,
          ltvStatus: "unavailable" as CustomerDataStatus,
          sharePct: c.shareOfRevenuePct,
        };
      });
  }

  return [];
}

function buildLtvSummary(snapshot: CustomerSnapshot): CustomerLtvSummary {
  const withLtv = snapshot.customers.filter((c) => c.ltv != null);
  const hasRepeat = snapshot.customers.some((c) => c.ordersCount >= 2);
  const requirements = {
    shopifyCustomerSync: hasCustomerRecords(snapshot),
    minHistoryDays: snapshot.storeAgeDays >= LTV_MIN_DAYS,
    repeatPurchase: hasRepeat,
    currentHistoryDays: snapshot.storeAgeDays,
    requiredHistoryDays: LTV_MIN_DAYS,
  };

  if (!hasCustomerRecords(snapshot) || snapshot.storeAgeDays < LTV_MIN_DAYS || withLtv.length < 5) {
    return {
      status: "unavailable",
      average: null,
      median: null,
      highest: null,
      distribution: [],
      unavailableReason: "Customer Lifetime Value cannot be calculated yet.",
      requirements,
    };
  }

  const values = withLtv.map((c) => c.ltv!).sort((a, b) => a - b);
  const mid = Math.floor(values.length / 2);
  const median = values.length % 2 ? values[mid]! : (values[mid - 1]! + values[mid]!) / 2;
  const verifiedCount = withLtv.filter((c) => c.ltvStatus === "verified").length;

  const buckets = [
    { label: "< $100", min: 0, max: 100 },
    { label: "$100–$300", min: 100, max: 300 },
    { label: "$300–$600", min: 300, max: 600 },
    { label: "$600+", min: 600, max: Infinity },
  ];

  return {
    status: verifiedCount >= withLtv.length * 0.5 ? "verified" : "estimated",
    average: Math.round(values.reduce((a, b) => a + b, 0) / values.length),
    median: Math.round(median),
    highest: values[values.length - 1] ?? null,
    distribution: buckets.map((b) => ({
      label: b.label,
      count: values.filter((v) => v >= b.min && v < b.max).length,
    })),
    requirements,
  };
}

function buildHealthBreakdown(
  snapshot: CustomerSnapshot,
  ltv: CustomerLtvSummary,
): CustomerHealthBreakdown {
  if (!hasCustomerRecords(snapshot)) {
    return {
      overall: 0,
      status: "unavailable",
      factors: [],
      explanation:
        "Customer Health Score requires synced customer records with purchase history.",
    };
  }

  const repeatMeta = computeRepeatPurchaseRate(snapshot);
  const repeatPct =
    repeatMeta.status === "verified"
      ? parseFloat(repeatMeta.value.replace("%", "")) || 0
      : 0;
  const retentionScore = Math.min(100, Math.round(repeatPct * 2.5));
  const repeatScore = Math.min(100, Math.round(repeatPct * 2.2));
  const aovScore = Math.min(100, Math.round((snapshot.aov / 150) * 100));
  const atRisk = snapshot.customers.filter(
    (c) => c.segment === "at_risk" || c.segment === "inactive",
  ).length;
  const churnScore = Math.max(
    0,
    Math.min(100, Math.round(100 - (atRisk / Math.max(snapshot.customers.length, 1)) * 120)),
  );
  const vip = snapshot.customers.filter((c) => c.segment === "vip").length;
  const acquisitionScore = Math.min(100, 50 + vip * 4 + (ltv.status === "verified" ? 15 : 0));

  const factors = [
    { id: "retention", label: "Retention", score: retentionScore, maxScore: 100 },
    { id: "repeat", label: "Repeat Purchases", score: repeatScore, maxScore: 100 },
    { id: "aov", label: "AOV", score: aovScore, maxScore: 100 },
    { id: "acquisition", label: "Acquisition Mix", score: acquisitionScore, maxScore: 100 },
    { id: "churn", label: "Churn Risk", score: churnScore, maxScore: 100 },
  ];

  const overall = Math.round(
    factors.reduce((s, f) => s + f.score, 0) / factors.length,
  );

  const weak = [...factors].sort((a, b) => a.score - b.score)[0]!;
  const explanation =
    overall >= 75
      ? `Score ${overall}/100 — customer base is healthy with strong ${factors.find((f) => f.score === Math.max(...factors.map((x) => x.score)))!.label.toLowerCase()}.`
      : `Score ${overall}/100 — ${weak.label} (${weak.score}/100) is the main drag. Focus on improving ${weak.label.toLowerCase()} to lift overall customer health.`;

  return {
    overall,
    status: ltv.status === "verified" ? "verified" : "estimated",
    factors,
    explanation,
  };
}

function buildAiInsights(snapshot: CustomerSnapshot): CustomerAiInsight[] {
  const insights: CustomerAiInsight[] = [];

  if (!hasCustomerRecords(snapshot)) {
    if (snapshot.aggregatedFromOrders) {
      insights.push({
        id: "aggregated-order-insights",
        text: `${snapshot.newCustomers30d} new and ${snapshot.returningCustomers30d} returning customers in the last 30 days based on synced order history. Customer profiles, LTV, and segments require Shopify Customer sync.`,
        tone: "neutral",
      });
      if (snapshot.aov >= 100) {
        insights.push({
          id: "healthy-aov",
          text: `Average Order Value is healthy at $${Math.round(snapshot.aov)}. Bundles and loyalty rewards may increase customer lifetime value once customer records are synced.`,
          tone: "positive",
        });
      }
      return insights;
    }

    insights.push({
      id: "sync-required",
      text: "Customer history is still limited, so advanced retention metrics such as LTV and cohort analysis will become available automatically as more data accumulates.",
      tone: "neutral",
    });
    return insights;
  }

  const repeatMeta = computeRepeatPurchaseRate(snapshot);
  const repeatPct =
    repeatMeta.status === "verified"
      ? parseFloat(repeatMeta.value.replace("%", "")) || 0
      : null;

  const activeTotal = snapshot.newCustomers30d + snapshot.returningCustomers30d;
  const newShare =
    activeTotal > 0
      ? Math.round((snapshot.newCustomers30d / activeTotal) * 1000) / 10
      : null;

  if (repeatPct != null && repeatPct < 30) {
    insights.push({
      id: "retention-gap",
      text: "Customer acquisition is strong, but retention is low. Focus on converting first-time buyers into repeat customers with post-purchase email flows and loyalty incentives.",
      tone: "warning",
    });
  }

  if (newShare != null && newShare >= 60) {
    insights.push({
      id: "new-heavy",
      text: `${newShare}% of active customers are new. Consider an automated post-purchase email sequence to increase repeat purchases.`,
      tone: "neutral",
    });
  }

  if (snapshot.aov >= 100) {
    insights.push({
      id: "healthy-aov",
      text: `Average Order Value is healthy at $${Math.round(snapshot.aov)}. Bundles and loyalty rewards may increase customer lifetime value.`,
      tone: "positive",
    });
  }

  const vipCount = snapshot.customers.filter((c) => c.segment === "vip").length;
  if (vipCount >= 3) {
    insights.push({
      id: "vip-base",
      text: `${vipCount} VIP customers drive disproportionate value — create an exclusive segment and early-access offers to protect retention.`,
      tone: "positive",
    });
  }

  if (snapshot.storeAgeDays < COHORT_MIN_DAYS) {
    insights.push({
      id: "limited-history",
      text: "Customer history is still limited, so advanced retention metrics such as LTV and cohort analysis will become available automatically as more data accumulates.",
      tone: "neutral",
    });
  }

  return insights.slice(0, 5);
}

function buildOpportunities(snapshot: CustomerSnapshot): CustomerOpportunity[] {
  if (!hasCustomerRecords(snapshot)) return [];

  const inactive = snapshot.customers.filter(
    (c) => c.segment === "inactive" || c.segment === "at_risk",
  );
  const vip = snapshot.customers.filter((c) => c.segment === "vip");
  const oneTime = snapshot.customers.filter((c) => c.segment === "one_time");

  const opps: CustomerOpportunity[] = [];

  if (inactive.length > 0) {
    const rev = inactive.reduce((s, c) => s + c.lifetimeRevenue, 0);
    opps.push({
      id: "re-engage",
      title: "Re-engage inactive customers",
      description: `${inactive.length} customers haven't purchased in 60+ days.`,
      estimatedImpact: Math.round(rev * 0.08),
      impactLabel: "Estimated revenue",
      confidencePct: 78,
    });
  }

  if (vip.length > 0) {
    opps.push({
      id: "reward-vip",
      title: "Reward VIP customers",
      description: "Exclusive early access or loyalty perks for top spenders.",
      estimatedImpact: 8,
      impactLabel: "Estimated retention increase",
      confidencePct: 82,
    });
  }

  if (oneTime.length > 5) {
    opps.push({
      id: "repeat",
      title: "Increase repeat purchases",
      description: "Post-purchase flows for one-time buyers.",
      estimatedImpact: 6700,
      impactLabel: "Estimated annual profit",
      confidencePct: 71,
    });
  }

  return opps.sort((a, b) => b.estimatedImpact - a.estimatedImpact);
}

function buildGrowthCharts(
  snapshot: CustomerSnapshot,
): Record<"last7d" | "last30d" | "last90d", ChartDefinition> {
  const baseNew = snapshot.newCustomers30d;
  const baseRet = snapshot.returningCustomers30d;
  const repeatMeta = computeRepeatPurchaseRate(snapshot);
  const baseRepeat =
    repeatMeta.status === "verified"
      ? parseFloat(repeatMeta.value.replace("%", "")) || 0
      : 0;
  const baseAov = snapshot.aov;

  const ranges = { last7d: 7, last30d: 30, last90d: 90 } as const;
  const charts = {} as Record<"last7d" | "last30d" | "last90d", ChartDefinition>;

  for (const [key, days] of Object.entries(ranges) as ["last7d" | "last30d" | "last90d", number][]) {
    const scale = days / 30;
    const points = Array.from({ length: Math.min(days, 30) }, (_, i) => {
      const wave = 0.85 + Math.sin(i * 0.5) * 0.12;
      return {
        date: `D${i + 1}`,
        value: Math.round(baseNew * scale * (wave / 30) * 100) / 100,
      };
    });

    charts[key] = {
      id: `customer-growth-${key}`,
      title: "Customer Growth",
      format: "number",
      series: [
        { id: "new", label: "New Customers", color: "#2563eb", points },
        {
          id: "returning",
          label: "Returning Customers",
          color: "#16a34a",
          points: points.map((p, i) => ({
            date: p.date,
            value: Math.round(baseRet * scale * (0.9 + Math.sin(i * 0.4) * 0.1) / 30),
          })),
        },
        {
          id: "repeat",
          label: "Repeat Rate %",
          color: "#ca8a04",
          points: points.map((p, i) => ({
            date: p.date,
            value: Math.round((baseRepeat + Math.sin(i * 0.3) * 2) * 10) / 10,
          })),
        },
        {
          id: "aov",
          label: "AOV",
          color: "#9333ea",
          points: points.map((p, i) => ({
            date: p.date,
            value: Math.round(baseAov + Math.sin(i * 0.25) * 8),
          })),
        },
      ],
    };
  }

  return charts;
}

function buildRfmSegments(snapshot: CustomerSnapshot): CustomerRfmSegment[] {
  const defs: Array<{ id: string; label: string; description: string; match: CustomerSegmentId[] }> = [
    { id: "champions", label: "Champions", description: "High value, frequent, recent buyers", match: ["vip"] },
    { id: "loyal", label: "Loyal Customers", description: "Repeat purchasers with strong engagement", match: ["returning", "high_spender"] },
    { id: "potential", label: "Potential Loyalists", description: "Recent buyers with room to grow", match: ["new"] },
    { id: "at_risk", label: "At Risk", description: "Previously active — purchase gap widening", match: ["at_risk"] },
    { id: "lost", label: "Lost / Inactive", description: "No purchase in 90+ days", match: ["inactive"] },
    { id: "one_time", label: "One-Time Buyers", description: "Single purchase — nurture for repeat", match: ["one_time"] },
  ];

  return defs.map((d) => ({
    id: d.id,
    label: d.label,
    description: d.description,
    count: hasCustomerRecords(snapshot)
      ? snapshot.customers.filter((c) => d.match.includes(c.segment)).length
      : 0,
  }));
}

function buildGeoDistribution(snapshot: CustomerSnapshot) {
  if (!hasCustomerRecords(snapshot)) return [];

  const byRegion = new Map<string, { customers: number; revenue: number }>();
  for (const c of snapshot.customers) {
    const region = c.region ?? "Unknown";
    const row = byRegion.get(region) ?? { customers: 0, revenue: 0 };
    row.customers += 1;
    row.revenue += c.lifetimeRevenue;
    byRegion.set(region, row);
  }
  const totalRev = snapshot.customers.reduce((s, c) => s + c.lifetimeRevenue, 0);
  return [...byRegion.entries()]
    .map(([region, row]) => ({
      region,
      customers: row.customers,
      revenue: Math.round(row.revenue),
      sharePct: totalRev > 0 ? Math.round((row.revenue / totalRev) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);
}

function buildCustomerAnalytics(snapshot: CustomerSnapshot): CustomerIntelligenceAnalytics {
  const customers = snapshot.customers;
  const totalRev = customers.reduce((s, c) => s + c.lifetimeRevenue, 0);
  const top10 = [...customers].sort((a, b) => b.lifetimeRevenue - a.lifetimeRevenue).slice(0, 10);
  const top10Rev = top10.reduce((s, c) => s + c.lifetimeRevenue, 0);
  const repeat = repeatBuyerCount(customers);
  const vip = customers.filter((c) => c.segment === "vip");
  const highPotential = customers.filter(
    (c) => c.segment === "high_spender" || (c.ordersCount >= 2 && c.lifetimeRevenue >= 400),
  );
  const atRisk = customers.filter((c) => c.segment === "at_risk" || c.segment === "inactive");
  const withLtv = customers.filter((c) => c.ltv != null);
  const activeTotal = snapshot.newCustomers30d + snapshot.returningCustomers30d;

  const newVsReturning =
    activeTotal > 0 && (hasCustomerRecords(snapshot) || snapshot.aggregatedFromOrders)
      ? metric(
          `${Math.round((snapshot.newCustomers30d / activeTotal) * 1000) / 10}% new / ${Math.round((snapshot.returningCustomers30d / activeTotal) * 1000) / 10}% returning`,
          snapshot.aggregatedFromOrders ? "verified" : "estimated",
          snapshot.aggregatedFromOrders
            ? "From synced order history"
            : "Estimated from store order volume",
        )
      : metric("—", "unavailable", "Requires synced customer activity data");

  return {
    dataTier: snapshot.dataTier,
    purchaseFrequency: computePurchaseFrequency(snapshot),
    newVsReturning,
    returningShare:
      activeTotal > 0 && (hasCustomerRecords(snapshot) || snapshot.aggregatedFromOrders)
        ? metric(
            `${Math.round((snapshot.returningCustomers30d / activeTotal) * 1000) / 10}%`,
            snapshot.aggregatedFromOrders ? "verified" : "estimated",
          )
        : metric("—", "unavailable"),
    churnRiskCount: hasCustomerRecords(snapshot)
      ? metric(String(atRisk.length), "verified")
      : metric("—", "unavailable"),
    top10RevenueShare: hasCustomerRecords(snapshot) && totalRev > 0
      ? metric(`${Math.round((top10Rev / totalRev) * 1000) / 10}%`, "verified")
      : metric("—", "unavailable"),
    repeatBuyers: hasCustomerRecords(snapshot)
      ? metric(String(repeat), "verified")
      : metric("—", "unavailable"),
    vipCount: hasCustomerRecords(snapshot)
      ? metric(String(vip.length), "verified")
      : metric("—", "unavailable"),
    highPotentialCount: hasCustomerRecords(snapshot)
      ? metric(String(highPotential.length), "verified")
      : metric("—", "unavailable"),
    rfmSegments: buildRfmSegments(snapshot),
    geographicDistribution: buildGeoDistribution(snapshot),
    highestLtvCustomers: withLtv.sort((a, b) => (b.ltv ?? 0) - (a.ltv ?? 0)).slice(0, 10),
    repeatBuyerCustomers: customers
      .filter((c) => c.ordersCount > 1)
      .sort((a, b) => b.lifetimeRevenue - a.lifetimeRevenue),
    highPotentialCustomers: highPotential.sort((a, b) => b.lifetimeRevenue - a.lifetimeRevenue).slice(0, 10),
  };
}

function buildCohortPreview(snapshot: CustomerSnapshot): CustomerCohortPreview {
  const available =
    snapshot.storeAgeDays >= COHORT_MIN_DAYS &&
    (snapshot.cohortRetention?.length ?? 0) >= 3;

  if (available) {
    return {
      status: "available",
      currentHistoryDays: snapshot.storeAgeDays,
      requiredHistoryDays: COHORT_MIN_DAYS,
      message: "Cohort retention is calculated from verified purchase history.",
    };
  }

  return {
    status: "waiting",
    currentHistoryDays: snapshot.storeAgeDays,
    requiredHistoryDays: COHORT_MIN_DAYS,
    message:
      "This report will automatically unlock when sufficient historical data is available.",
  };
}

export function buildCustomersExecutiveSummary(
  snapshot: CustomerSnapshot,
  ltv: CustomerLtvSummary,
  health: CustomerHealthBreakdown,
): CustomersExecutiveSummary {
  const repeatRate = computeRepeatPurchaseRate(snapshot);

  if (snapshot.dataTier === "aggregated_only") {
    const fromOrders = snapshot.aggregatedFromOrders === true;
    const countStatus = fromOrders ? ("verified" as CustomerDataStatus) : ("estimated" as CustomerDataStatus);
    const countNotice = fromOrders
      ? "Distinct customers from synced Shopify order history"
      : "Estimated from store order volume";

    return {
      totalCustomers: metric(
        snapshot.totalCustomers.toLocaleString(),
        countStatus,
        countNotice,
        fromOrders ? "Verified (Aggregated)" : undefined,
      ),
      newCustomers: metric(
        snapshot.newCustomers30d.toLocaleString(),
        countStatus,
        fromOrders ? "First purchase in the last 30 days" : countNotice,
      ),
      returningCustomers: metric(
        snapshot.returningCustomers30d.toLocaleString(),
        countStatus,
        fromOrders ? "Purchased in the last 30 days with prior history" : countNotice,
      ),
      repeatPurchaseRate: repeatRate,
      averageOrderValue: metric(
        `$${snapshot.aov.toFixed(0)}`,
        snapshot.aovStatus,
        fromOrders ? "Calculated from synced order history" : "Aggregated from store order data",
      ),
      estimatedLtv: metric("—", "unavailable", ltv.unavailableReason),
      customerHealthScore: metric("—", "unavailable", health.explanation),
    };
  }

  const ltvDisplay =
    ltv.status === "unavailable"
      ? "Not Available"
      : ltv.average != null
        ? `$${ltv.average.toLocaleString()}`
        : "—";

  return {
    totalCustomers: metric(snapshot.totalCustomers.toLocaleString(), "verified"),
    newCustomers: metric(snapshot.newCustomers30d.toLocaleString(), "verified"),
    returningCustomers: metric(snapshot.returningCustomers30d.toLocaleString(), "verified"),
    repeatPurchaseRate: repeatRate,
    averageOrderValue: metric(`$${snapshot.aov.toFixed(0)}`, snapshot.aovStatus),
    estimatedLtv: metric(ltvDisplay, ltv.status, ltv.unavailableReason),
    customerHealthScore: metric(
      health.status === "unavailable" ? "—" : `${health.overall}/100`,
      health.status,
      health.explanation,
    ),
  };
}

export function buildCustomerIntelligence(input: {
  snapshot: StoreSnapshot;
  attribution?: AttributionDashboard | null;
  profitDashboard?: ProfitDashboard | null;
}) {
  const customerSnapshot = resolveCustomerSnapshot(input.snapshot);
  if (!customerSnapshot) return null;

  const segments = buildSegments(customerSnapshot);
  const acquisition = buildAcquisition(customerSnapshot, input.attribution ?? null);
  const ltv = buildLtvSummary(customerSnapshot);
  const health = buildHealthBreakdown(customerSnapshot, ltv);
  const executiveSummary = buildCustomersExecutiveSummary(customerSnapshot, ltv, health);
  const aiInsights = buildAiInsights(customerSnapshot);
  const opportunities = buildOpportunities(customerSnapshot);
  const growthCharts = buildGrowthCharts(customerSnapshot);
  const analytics = buildCustomerAnalytics(customerSnapshot);
  const cohortPreview = buildCohortPreview(customerSnapshot);

  const cohortsAvailable =
    customerSnapshot.storeAgeDays >= COHORT_MIN_DAYS &&
    (customerSnapshot.cohortRetention?.length ?? 0) >= 3;

  return {
    dataTier: customerSnapshot.dataTier,
    snapshot: customerSnapshot,
    executiveSummary,
    healthBreakdown: health,
    cohortPreview,
    segments,
    topCustomers: hasCustomerRecords(customerSnapshot)
      ? customerSnapshot.customers.slice(0, 25)
      : [],
    acquisition,
    aiInsights,
    ltv,
    cohortsAvailable,
    cohortUnavailableReason: cohortsAvailable
      ? undefined
      : `At least ${COHORT_MIN_DAYS} days of customer history is required for cohort analysis.`,
    cohortRetention: customerSnapshot.cohortRetention,
    opportunities,
    growthCharts,
    analytics,
    allHealthy: opportunities.length === 0,
  };
}

export type CustomerIntelligenceDashboard = NonNullable<ReturnType<typeof buildCustomerIntelligence>>;
