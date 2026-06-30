import type { ProductRecommendationBadge } from "@/lib/products/recommendations";
import type { InventoryHealthBreakdown } from "./summary";

export type InventoryDataStatus = "verified" | "estimated" | "unavailable";

export type InventorySegmentId =
  | "dead"
  | "slow"
  | "fast"
  | "low_stock"
  | "out_of_stock";

export const INVENTORY_SEGMENT_LABELS: Record<InventorySegmentId, string> = {
  dead: "Dead Inventory",
  slow: "Slow Movers",
  fast: "Fast Movers",
  low_stock: "Low Stock",
  out_of_stock: "Out Of Stock",
};

export const INVENTORY_SEGMENT_DESCRIPTIONS: Record<InventorySegmentId, string> = {
  dead: "No sales in 90+ days",
  slow: "Below velocity target",
  fast: "High velocity SKUs",
  low_stock: "At risk of stockout",
  out_of_stock: "Zero inventory",
};

export type InventoryMetricMeta = {
  value: string;
  status: InventoryDataStatus;
  notice?: string;
};

export type InventorySegmentCard = {
  id: InventorySegmentId;
  label: string;
  description: string;
  count: number;
  valueAtRisk: number;
  footnote?: string;
};

export type InventoryExecutiveSummary = {
  totalSkus: InventoryMetricMeta;
  unitsOnHand: InventoryMetricMeta;
  inventoryValue: InventoryMetricMeta;
  deadStockValue: InventoryMetricMeta;
  atRiskSkus: InventoryMetricMeta;
  inventoryCoverage: InventoryMetricMeta;
};

export type InventorySkuRecommendation = {
  badge: ProductRecommendationBadge;
  label: string;
  summary: string;
  reason: string;
  expectedImpact: number;
  confidencePct: number;
};

export type InventorySkuRow = {
  productId: string;
  title: string;
  imageUrl: string | null;
  inventory: number;
  unitsSold30d: number;
  velocityPerDay: number;
  daysUntilStockout: number | null;
  estimatedStockoutLabel: string;
  segment: InventorySegmentId;
  inventoryValue: number;
  revenue30d: number;
  netProfit: number | null;
  profitStatus: InventoryDataStatus;
  recommendation: InventorySkuRecommendation | null;
};

export type InventoryOpportunity = {
  id: string;
  badge: ProductRecommendationBadge;
  title: string;
  productTitle: string;
  description: string;
  estimatedMonthlyImpact: number;
  confidencePct: number;
};

export type InventoryAiInsight = {
  id: string;
  title?: string;
  text: string;
  actions?: string[];
  tone: "positive" | "neutral" | "warning";
};

export type InventoryPageView = {
  executiveSummary: InventoryExecutiveSummary;
  healthBreakdown: InventoryHealthBreakdown;
  segments: InventorySegmentCard[];
  opportunities: InventoryOpportunity[];
  aiInsights: InventoryAiInsight[];
  riskTable: InventorySkuRow[];
  allHealthy: boolean;
  recoveryPotential: number;
  limitedInventoryNotice?: string;
};

export function formatEstimatedStockout(
  row: Pick<InventorySkuRow, "inventory" | "velocityPerDay" | "daysUntilStockout">,
  now = new Date(),
): string {
  if (row.inventory <= 0) return "Already Out of Stock";
  if (row.velocityPerDay <= 0 || row.daysUntilStockout == null) return "—";

  const daysLeft = row.daysUntilStockout;
  if (daysLeft <= 0) return "Today";

  const stockoutDate = new Date(now);
  stockoutDate.setDate(stockoutDate.getDate() + Math.ceil(daysLeft));

  const diffDays = Math.ceil(
    (stockoutDate.getTime() - now.getTime()) / 86_400_000,
  );

  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Tomorrow";

  return stockoutDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}
