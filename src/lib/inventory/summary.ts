import type { ShopifyProduct } from "@/lib/connectors/types";
import type { InventoryDataStatus, InventorySegmentId } from "./types";

export type InventorySummary = {
  totalProducts: number;
  inStock: number;
  outOfStock: number;
  lowStock: number;
  lowStockThreshold: number;
};

export type InventoryHealthFactor = {
  id: string;
  label: string;
  score: number;
  maxScore: number;
};

export type InventoryHealthBreakdown = {
  overall: number;
  status: InventoryDataStatus;
  factors: InventoryHealthFactor[];
  explanation: string;
};

export function getLowStockThreshold(): number {
  const raw = process.env.LOW_STOCK_THRESHOLD;
  if (!raw) return 5;
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 5;
}

export function computeInventorySummary(
  products: ShopifyProduct[],
  threshold = getLowStockThreshold(),
): InventorySummary {
  let inStock = 0;
  let outOfStock = 0;
  let lowStock = 0;

  for (const product of products) {
    const qty = product.inventoryQuantity;
    if (qty <= 0) {
      outOfStock += 1;
    } else if (qty <= threshold) {
      lowStock += 1;
    } else {
      inStock += 1;
    }
  }

  return {
    totalProducts: products.length,
    inStock,
    outOfStock,
    lowStock,
    lowStockThreshold: threshold,
  };
}

type HealthRow = {
  segment: InventorySegmentId;
  inventory: number;
  velocityPerDay: number;
  daysUntilStockout: number | null;
};

/**
 * Factor-based inventory health score (0–100) with transparent breakdown.
 */
export function computeInventoryHealthBreakdown(
  summary: InventorySummary,
  rows: HealthRow[],
): InventoryHealthBreakdown {
  const total = Math.max(summary.totalProducts, 1);
  const inStockCount = summary.inStock + summary.lowStock;

  const availabilityScore = Math.round((inStockCount / total) * 100);

  const inStockRows = rows.filter((r) => r.inventory > 0);
  const balancedCount = inStockRows.filter((r) => r.segment === "fast").length;
  const stockBalanceScore =
    inStockRows.length > 0
      ? Math.round((balancedCount / inStockRows.length) * 100)
      : 100;

  const deadCount = rows.filter((r) => r.segment === "dead").length;
  const deadStockScore = Math.round(100 - (deadCount / total) * 100);

  const withVelocity = rows.filter((r) => r.velocityPerDay > 0);
  let velocityScore = 70;
  if (withVelocity.length > 0) {
    const wellCovered = withVelocity.filter(
      (r) =>
        r.inventory > 0 &&
        (r.daysUntilStockout == null || r.daysUntilStockout >= LOW_STOCK_DAYS),
    ).length;
    const oosWithDemand = withVelocity.filter((r) => r.inventory === 0).length;
    const coveragePct = Math.round((wellCovered / withVelocity.length) * 100);

    if (oosWithDemand > 0 && wellCovered === 0) {
      velocityScore = 80;
    } else {
      velocityScore = Math.max(0, coveragePct - oosWithDemand * 15);
    }
  } else if (inStockCount === 0) {
    velocityScore = 40;
  }

  const overall = Math.round(
    availabilityScore * 0.5 +
      stockBalanceScore * 0.1 +
      deadStockScore * 0.1 +
      velocityScore * 0.3,
  );

  const factors: InventoryHealthFactor[] = [
    { id: "availability", label: "Availability", score: availabilityScore, maxScore: 100 },
    { id: "stockBalance", label: "Stock Balance", score: stockBalanceScore, maxScore: 100 },
    { id: "deadStock", label: "Dead Stock", score: deadStockScore, maxScore: 100 },
    { id: "velocity", label: "Velocity", score: velocityScore, maxScore: 100 },
  ];

  const weakest = [...factors].sort((a, b) => a.score - b.score)[0]!;
  const explanation =
    overall >= 70
      ? `Score ${overall}/100 — inventory is in good shape with strong ${factors.find((f) => f.score === Math.max(...factors.map((x) => x.score)))!.label.toLowerCase()}.`
      : `Score ${overall}/100 — ${weakest.label} (${weakest.score}%) is the primary drag. Address ${weakest.label.toLowerCase()} to improve overall inventory health.`;

  return {
    overall,
    status: overall >= 70 ? "verified" : "estimated",
    factors,
    explanation,
  };
}

const LOW_STOCK_DAYS = 14;

/** @deprecated Use computeInventoryHealthBreakdown */
export function computeInventoryHealthScore(
  summary: InventorySummary,
  recommendationPenalty: number,
): number {
  const oosPenalty = summary.outOfStock * 12;
  const lowPenalty = summary.lowStock * 5;
  const totalPenalty = recommendationPenalty + oosPenalty + lowPenalty;
  return Math.max(0, 100 - totalPenalty);
}

export function isInventoryTrackingUnavailable(products: ShopifyProduct[]): boolean {
  const withTrackingFlag = products.filter((p) => p.inventoryTracked !== undefined);
  if (withTrackingFlag.length > 0) {
    return withTrackingFlag.every((p) => p.inventoryTracked === false);
  }

  const allZero = products.every((p) => p.inventoryQuantity === 0);
  const hasPriced = products.some((p) => p.price > 0);
  return allZero && hasPriced && products.length > 0;
}

export function computeInventoryCoverageDays(
  rows: Array<{ inventory: number; velocityPerDay: number; daysUntilStockout: number | null }>,
): number {
  const coverable = rows.filter(
    (r) => r.velocityPerDay > 0 && r.inventory > 0 && r.daysUntilStockout != null,
  );
  if (coverable.length === 0) return 0;
  const total = coverable.reduce((s, r) => s + (r.daysUntilStockout ?? 0), 0);
  return Math.round((total / coverable.length) * 10) / 10;
}
