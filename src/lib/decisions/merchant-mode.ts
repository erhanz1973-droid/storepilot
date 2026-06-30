export type MerchantMode =
  | "profit"
  | "cash_flow"
  | "growth"
  | "inventory_clearance"
  | "launch";

export const MERCHANT_MODE_LABELS: Record<MerchantMode, string> = {
  profit: "Profit Mode",
  cash_flow: "Cash Flow Mode",
  growth: "Growth Mode",
  inventory_clearance: "Inventory Clearance Mode",
  launch: "Launch Mode",
};

export const MERCHANT_MODE_DESCRIPTIONS: Record<MerchantMode, string> = {
  profit: "Maximize expected net profit on every decision.",
  cash_flow: "Convert inventory into cash as quickly as possible.",
  growth: "Acquire customers and volume even if margins compress.",
  inventory_clearance: "Prioritize clearing aged and slow-moving stock.",
  launch: "Prioritize visibility and traction for new products.",
};

export type ModeScoreWeights = {
  netProfit: number;
  revenue: number;
  inventoryReduction: number;
  cashRecovery: number;
  unitsSold: number;
  roasImpact: number;
};

export const MODE_SCORE_WEIGHTS: Record<MerchantMode, ModeScoreWeights> = {
  profit: { netProfit: 1, revenue: 0.15, inventoryReduction: 0.2, cashRecovery: 0.25, unitsSold: 0.05, roasImpact: 0.3 },
  cash_flow: { netProfit: 0.5, revenue: 0.2, inventoryReduction: 0.6, cashRecovery: 1, unitsSold: 0.25, roasImpact: 0.15 },
  growth: { netProfit: 0.35, revenue: 0.8, inventoryReduction: 0.15, cashRecovery: 0.2, unitsSold: 1, roasImpact: 0.5 },
  inventory_clearance: { netProfit: 0.4, revenue: 0.25, inventoryReduction: 1, cashRecovery: 0.85, unitsSold: 0.55, roasImpact: 0.1 },
  launch: { netProfit: 0.25, revenue: 0.7, inventoryReduction: 0.1, cashRecovery: 0.15, unitsSold: 0.9, roasImpact: 0.75 },
};

export function normalizeMerchantMode(raw?: string | null): MerchantMode {
  const key = (raw ?? "profit").toLowerCase().replace(/-/g, "_") as MerchantMode;
  if (key in MODE_SCORE_WEIGHTS) return key;
  return "profit";
}

export function scoreStrategyForMode(
  mode: MerchantMode,
  metrics: {
    netProfit: number;
    revenue: number;
    inventoryReduction: number;
    cashRecovery: number;
    unitsSold: number;
    roasImpact: number;
  },
): number {
  const w = MODE_SCORE_WEIGHTS[mode];
  return (
    metrics.netProfit * w.netProfit +
    metrics.revenue * w.revenue +
    metrics.inventoryReduction * w.inventoryReduction +
    metrics.cashRecovery * w.cashRecovery +
    metrics.unitsSold * w.unitsSold +
    metrics.roasImpact * w.roasImpact
  );
}
