import type { ProductAttributionDashboard } from "@/lib/attribution/product-types";
import type { StoreSnapshot } from "@/lib/connectors/types";
import {
  computeInventoryCoverageDays,
  computeInventoryHealthBreakdown,
  computeInventorySummary,
  isInventoryTrackingUnavailable,
} from "@/lib/inventory/summary";
import type { ProductIntelligenceDashboard, ProductIntelligenceProfile } from "@/lib/products/types";
import {
  deriveProductRecommendation,
  RECOMMENDATION_BADGE_LABELS,
  type ProductRecommendationBadge,
} from "@/lib/products/recommendations";
import {
  formatEstimatedStockout,
  INVENTORY_SEGMENT_DESCRIPTIONS,
  INVENTORY_SEGMENT_LABELS,
  type InventoryAiInsight,
  type InventoryDataStatus,
  type InventoryExecutiveSummary,
  type InventoryOpportunity,
  type InventoryPageView,
  type InventorySegmentCard,
  type InventorySegmentId,
  type InventorySkuRow,
} from "./types";

const LOW_STOCK_DAYS = 14;
const DEAD_UNITS_THRESHOLD = 3;
const DEAD_MIN_INVENTORY = 20;
const FAST_VELOCITY_MIN_UNITS = 80;
const SLOW_OVERSTOCK_MIN = 60;
const SLOW_MAX_UNITS = 20;

function metric(
  value: string,
  status: InventoryDataStatus,
  notice?: string,
): { value: string; status: InventoryDataStatus; notice?: string } {
  return { value, status, notice };
}

function classifySegment(
  product: StoreSnapshot["products"][0],
  profile: ProductIntelligenceProfile | undefined,
  medianVelocity: number,
): InventorySegmentId {
  const inv = product.inventoryQuantity;
  const units = product.unitsSold30d;
  const daily = units / 30;

  if (inv === 0) return "out_of_stock";

  if (
    product.tags?.includes("dead-inventory") ||
    (units === 0 && inv > 0) ||
    (units < DEAD_UNITS_THRESHOLD && inv >= DEAD_MIN_INVENTORY)
  ) {
    return "dead";
  }

  if (profile?.inventoryRisk === "low_stock" || (daily > 0 && inv / daily <= LOW_STOCK_DAYS)) {
    return "low_stock";
  }

  if (
    profile?.isHero ||
    units >= FAST_VELOCITY_MIN_UNITS ||
    (daily >= medianVelocity * 1.5 && units >= 15)
  ) {
    return "fast";
  }

  if (
    profile?.inventoryRisk === "overstock" ||
    product.tags?.includes("overstock") ||
    (inv >= SLOW_OVERSTOCK_MIN && units <= SLOW_MAX_UNITS)
  ) {
    return "slow";
  }

  if (profile?.inventoryRisk === "dead") return "dead";

  return "fast";
}

function inventoryUnitValue(product: StoreSnapshot["products"][0]): number {
  return product.unitCost ?? Math.round(product.price * 0.42 * 100) / 100;
}

function fallbackRecommendation(
  product: StoreSnapshot["products"][0],
  segment: InventorySegmentId,
  attr: ProductAttributionDashboard["byProductId"][string] | null | undefined,
): InventorySkuRow["recommendation"] {
  const dailyAd =
    attr != null
      ? ((attr.sources.meta ?? 0) + (attr.sources.google ?? 0)) / 30
      : 0;

  if (segment === "out_of_stock" && product.unitsSold30d > 0) {
    const impact = Math.round(Math.max(dailyAd, product.revenue30d / 30) * 30);
    return {
      badge: "pause_advertising",
      label: RECOMMENDATION_BADGE_LABELS.pause_advertising,
      summary: "Pause advertising until inventory returns",
      reason: "Active advertising is driving demand for an unavailable product.",
      expectedImpact: impact,
      confidencePct: dailyAd > 0 ? 96 : 82,
    };
  }

  if (segment === "dead" || segment === "slow") {
    return {
      badge: "discount",
      label: RECOMMENDATION_BADGE_LABELS.discount,
      summary: "Run clearance or bundle promotion",
      reason: "Inventory is not moving at the current price point.",
      expectedImpact: Math.round(
        product.inventoryQuantity * inventoryUnitValue(product) * 0.15,
      ),
      confidencePct: 72,
    };
  }

  if (segment === "low_stock") {
    return {
      badge: "restock",
      label: RECOMMENDATION_BADGE_LABELS.restock,
      summary: "Restock before stockout",
      reason: "Velocity indicates stock will run out before replenishment if no action is taken.",
      expectedImpact: Math.round(product.revenue30d * 0.25),
      confidencePct: 80,
    };
  }

  return null;
}

function buildSkuRow(
  product: StoreSnapshot["products"][0],
  profile: ProductIntelligenceProfile | undefined,
  segment: InventorySegmentId,
  attribution: ProductAttributionDashboard | null,
): InventorySkuRow {
  const daily = product.unitsSold30d / 30;
  const daysUntilStockout =
    daily > 0
      ? Math.round((product.inventoryQuantity / daily) * 10) / 10
      : product.inventoryQuantity > 0
        ? null
        : 0;

  const attr = attribution?.byProductId[product.id];
  const derived =
    profile != null ? deriveProductRecommendation(profile, attr ?? null) : null;
  const fallback = derived ? null : fallbackRecommendation(product, segment, attr);

  const recommendation = derived
    ? {
        badge: derived.badge,
        label: derived.label,
        summary: derived.summary,
        reason: derived.reasoning[0] ?? derived.summary,
        expectedImpact: derived.expectedMonthlyImpact,
        confidencePct: derived.confidencePct,
      }
    : fallback;

  const rowBase = {
    productId: product.id,
    title: product.title,
    imageUrl: product.imageUrl ?? null,
    inventory: product.inventoryQuantity,
    unitsSold30d: product.unitsSold30d,
    velocityPerDay: Math.round(daily * 100) / 100,
    daysUntilStockout,
    segment,
    inventoryValue: Math.round(product.inventoryQuantity * inventoryUnitValue(product)),
    revenue30d: product.revenue30d,
    netProfit: profile?.netProfit ?? null,
    profitStatus: (profile ? "verified" : "estimated") as InventoryDataStatus,
    recommendation,
  };

  return {
    ...rowBase,
    estimatedStockoutLabel: formatEstimatedStockout(rowBase),
  };
}

function buildSegments(
  rows: InventorySkuRow[],
  products: StoreSnapshot["products"],
): InventorySegmentCard[] {
  const ids: InventorySegmentId[] = [
    "dead",
    "slow",
    "fast",
    "low_stock",
    "out_of_stock",
  ];

  const allDepleted =
    products.length > 0 && products.every((p) => p.inventoryQuantity <= 0);
  const deadFootnote =
    allDepleted && rows.filter((r) => r.segment === "dead").length === 0
      ? "No inventory currently qualifies as dead stock because all tracked inventory is depleted."
      : undefined;

  return ids.map((id) => {
    const members = rows.filter((r) => r.segment === id);
    return {
      id,
      label: INVENTORY_SEGMENT_LABELS[id],
      description: INVENTORY_SEGMENT_DESCRIPTIONS[id],
      count: members.length,
      valueAtRisk: members.reduce((s, r) => s + r.inventoryValue, 0),
      footnote: id === "dead" ? deadFootnote : undefined,
    };
  });
}

function buildExecutiveSummary(
  rows: InventorySkuRow[],
  snapshot: StoreSnapshot,
  summary: ReturnType<typeof computeInventorySummary>,
): InventoryExecutiveSummary {
  const trackingUnavailable = isInventoryTrackingUnavailable(snapshot.products);
  const totalValue = rows.reduce((s, r) => s + r.inventoryValue, 0);
  const deadValue = rows
    .filter((r) => r.segment === "dead")
    .reduce((s, r) => s + r.inventoryValue, 0);
  const atRisk = rows.filter(
    (r) => r.segment === "low_stock" || r.segment === "out_of_stock",
  ).length;
  const coverageDays = computeInventoryCoverageDays(rows);
  const hasCostData = snapshot.products.some((p) => p.unitCost != null);

  return {
    totalSkus: metric(summary.totalProducts.toLocaleString(), "verified"),
    unitsOnHand: metric(
      rows.reduce((s, r) => s + r.inventory, 0).toLocaleString(),
      trackingUnavailable ? "unavailable" : "verified",
      trackingUnavailable
        ? "Inventory quantities are not tracked for this store."
        : undefined,
    ),
    inventoryValue: trackingUnavailable
      ? metric(
          "Unavailable",
          "unavailable",
          "Inventory quantities are not tracked for this store.",
        )
      : metric(
          `$${totalValue.toLocaleString()}`,
          hasCostData ? "verified" : "estimated",
          hasCostData ? undefined : "Based on estimated unit costs",
        ),
    deadStockValue: trackingUnavailable
      ? metric("—", "unavailable", "Requires tracked inventory quantities.")
      : metric(`$${deadValue.toLocaleString()}`, deadValue > 0 ? "verified" : "estimated"),
    atRiskSkus: metric(atRisk.toLocaleString(), "verified"),
    inventoryCoverage: metric(
      `${coverageDays} days`,
      coverageDays > 0 ? "verified" : "estimated",
      coverageDays === 0
        ? "No in-stock SKUs with measurable sales velocity."
        : "Average days of cover across active SKUs",
    ),
  };
}

function buildOpportunities(rows: InventorySkuRow[]): InventoryOpportunity[] {
  const opps: InventoryOpportunity[] = [];

  for (const row of rows) {
    if (!row.recommendation) continue;
    const badge = row.recommendation.badge;
    if (
      badge !== "restock" &&
      badge !== "discount" &&
      badge !== "create_bundle"
    ) {
      continue;
    }
    if (row.recommendation.expectedImpact <= 0) continue;

    opps.push({
      id: `inv-${row.productId}-${badge}`,
      badge,
      title: row.recommendation.label,
      productTitle: row.title,
      description: row.recommendation.summary,
      estimatedMonthlyImpact: row.recommendation.expectedImpact,
      confidencePct: row.recommendation.confidencePct,
    });
  }

  return opps
    .sort((a, b) => b.estimatedMonthlyImpact - a.estimatedMonthlyImpact)
    .slice(0, 6);
}

function buildAiInsights(
  rows: InventorySkuRow[],
  segments: InventorySegmentCard[],
): InventoryAiInsight[] {
  const insights: InventoryAiInsight[] = [];
  const dead = segments.find((s) => s.id === "dead");
  const lowStock = segments.find((s) => s.id === "low_stock");
  const fast = segments.find((s) => s.id === "fast");
  const oos = segments.find((s) => s.id === "out_of_stock");

  if (oos && oos.count > 0) {
    const topOos = rows
      .filter((r) => r.segment === "out_of_stock")
      .sort((a, b) => b.velocityPerDay - a.velocityPerDay)[0];

    if (topOos && topOos.velocityPerDay > 0) {
      insights.push({
        id: "oos-recommendation",
        title: "AI Recommendation",
        text: `${topOos.title} is currently out of stock while demand continues (${topOos.velocityPerDay}/day).`,
        actions: [
          "Restock immediately.",
          "Pause advertising until inventory returns.",
          "Notify customers when available.",
          "Review supplier lead time.",
        ],
        tone: "warning",
      });
    } else {
      insights.push({
        id: "oos",
        text: `${oos.count} SKU${oos.count === 1 ? "" : "s"} ${oos.count === 1 ? "is" : "are"} out of stock — you may be losing sales on in-demand products.`,
        tone: "warning",
      });
    }
  }

  if (dead && dead.count > 0) {
    insights.push({
      id: "dead-value",
      text: `$${dead.valueAtRisk.toLocaleString()} in dead stock across ${dead.count} SKUs — clearance campaigns could recover capital.`,
      tone: "warning",
    });
  }

  if (lowStock && lowStock.count > 0) {
    const urgent = rows
      .filter((r) => r.segment === "low_stock" && r.daysUntilStockout != null)
      .sort((a, b) => (a.daysUntilStockout ?? 99) - (b.daysUntilStockout ?? 99))[0];
    insights.push({
      id: "stockout-risk",
      text: urgent
        ? `${lowStock.count} SKUs are at stockout risk — ${urgent.title} is projected to stock out ${urgent.estimatedStockoutLabel.toLowerCase()}.`
        : `${lowStock.count} SKUs are below the velocity safety threshold.`,
      tone: "warning",
    });
  }

  if (fast && fast.count > 0) {
    const top = rows
      .filter((r) => r.segment === "fast")
      .sort((a, b) => b.velocityPerDay - a.velocityPerDay)[0];
    if (top) {
      insights.push({
        id: "fast-mover",
        text: `${top.title} is a fast mover at ${top.velocityPerDay} units/day — ensure replenishment keeps pace.`,
        tone: "positive",
      });
    }
  }

  const slow = segments.find((s) => s.id === "slow");
  if (slow && slow.count > 0) {
    insights.push({
      id: "slow-movers",
      text: `${slow.count} slow-moving SKUs tie up $${slow.valueAtRisk.toLocaleString()} in inventory — consider bundles or targeted discounts.`,
      tone: "neutral",
    });
  }

  if (insights.length === 0) {
    insights.push({
      id: "healthy",
      text: "Inventory levels are balanced — no critical stockout or dead stock risks detected.",
      tone: "positive",
    });
  }

  return insights;
}

function buildLimitedInventoryNotice(
  summary: ReturnType<typeof computeInventorySummary>,
  rows: InventorySkuRow[],
): string | undefined {
  const totalValue = rows.reduce((s, r) => s + r.inventoryValue, 0);
  const unitsOnHand = rows.reduce((s, r) => s + r.inventory, 0);

  if (summary.totalProducts <= 1 && (totalValue === 0 || unitsOnHand === 0)) {
    return "Current inventory is extremely limited. Inventory analytics become more valuable as additional products and stock levels are synchronized.";
  }

  return undefined;
}

export function buildInventoryPageView(input: {
  snapshot: StoreSnapshot;
  intelligence: ProductIntelligenceDashboard | null;
  attribution?: ProductAttributionDashboard | null;
}): InventoryPageView | null {
  if (!input.snapshot.products.length) return null;

  const profileById = new Map(
    (input.intelligence?.products ?? []).map((p) => [p.productId, p]),
  );

  const velocities = input.snapshot.products
    .filter((p) => p.unitsSold30d > 0)
    .map((p) => p.unitsSold30d / 30)
    .sort((a, b) => a - b);
  const medianVelocity =
    velocities.length > 0
      ? velocities[Math.floor(velocities.length / 2)]!
      : 1;

  const rows = input.snapshot.products.map((product) => {
    const profile = profileById.get(product.id);
    const segment = classifySegment(product, profile, medianVelocity);
    return buildSkuRow(product, profile, segment, input.attribution ?? null);
  });

  const segments = buildSegments(rows, input.snapshot.products);
  const summary = computeInventorySummary(input.snapshot.products);
  const healthBreakdown = computeInventoryHealthBreakdown(summary, rows);

  const opportunities = buildOpportunities(rows);
  const recoveryPotential = opportunities.reduce((s, o) => s + o.estimatedMonthlyImpact, 0);
  const atRiskSegments = new Set<InventorySegmentId>([
    "dead",
    "slow",
    "low_stock",
    "out_of_stock",
  ]);
  const allHealthy = rows.every((r) => !atRiskSegments.has(r.segment));

  const riskTable = rows
    .filter((r) => atRiskSegments.has(r.segment))
    .sort((a, b) => {
      const priority: Record<InventorySegmentId, number> = {
        out_of_stock: 0,
        low_stock: 1,
        dead: 2,
        slow: 3,
        fast: 4,
      };
      const pd = priority[a.segment] - priority[b.segment];
      if (pd !== 0) return pd;
      return (a.daysUntilStockout ?? 999) - (b.daysUntilStockout ?? 999);
    });

  return {
    executiveSummary: buildExecutiveSummary(rows, input.snapshot, summary),
    healthBreakdown,
    segments,
    opportunities,
    aiInsights: buildAiInsights(rows, segments),
    riskTable,
    allHealthy,
    recoveryPotential,
    limitedInventoryNotice: buildLimitedInventoryNotice(summary, rows),
  };
}
