import type { ProductIntelligenceProfile } from "./types";

export type ProductHealthFactor = {
  id: string;
  label: string;
  score: number;
  maxScore: number;
  explanation: string;
};

export function computeProductHealthBreakdown(input: {
  marginPct: number;
  productRoas: number | null;
  revenueGrowthPct: number | null;
  refundRatePct: number;
  daysUntilStockout: number | null;
  inventory: number;
  unitsSold: number;
  netProfit: number;
}): ProductHealthFactor[] {
  const factors: ProductHealthFactor[] = [];

  let profitScore = 0;
  if (input.netProfit > 0) profitScore = 20;
  else if (input.netProfit === 0) profitScore = 8;
  factors.push({
    id: "profitability",
    label: "Profitability",
    score: profitScore,
    maxScore: 20,
    explanation:
      input.netProfit > 0
        ? `Net profit positive ($${Math.round(input.netProfit).toLocaleString()}/30d).`
        : "Product is losing money after allocated costs.",
  });

  let marginScore = 0;
  if (input.marginPct >= 45) marginScore = 15;
  else if (input.marginPct >= 25) marginScore = 10;
  else if (input.marginPct >= 15) marginScore = 6;
  factors.push({
    id: "margin",
    label: "Margin",
    score: marginScore,
    maxScore: 15,
    explanation: `${input.marginPct}% net margin after COGS, fees, and ads.`,
  });

  let adScore = 8;
  if (input.productRoas != null) {
    if (input.productRoas >= 3) adScore = 20;
    else if (input.productRoas >= 2) adScore = 16;
    else if (input.productRoas >= 1.2) adScore = 10;
    else adScore = 4;
  }
  factors.push({
    id: "advertising",
    label: "Advertising Efficiency",
    score: adScore,
    maxScore: 20,
    explanation:
      input.productRoas != null
        ? `Product ROAS ${input.productRoas.toFixed(2)} — revenue per ad dollar.`
        : "No paid advertising attributed to this SKU.",
  });

  let velocityScore = 8;
  if (input.unitsSold >= 80) velocityScore = 20;
  else if (input.unitsSold >= 30) velocityScore = 15;
  else if (input.unitsSold >= 10) velocityScore = 10;
  else if (input.unitsSold > 0) velocityScore = 6;
  factors.push({
    id: "velocity",
    label: "Sales Velocity",
    score: velocityScore,
    maxScore: 20,
    explanation: `${input.unitsSold} units sold in the last 30 days.`,
  });

  let inventoryScore = 15;
  if (input.inventory === 0) inventoryScore = 2;
  else if (input.daysUntilStockout != null && input.daysUntilStockout <= 7) inventoryScore = 5;
  else if (input.inventory > 80 && input.unitsSold < 15) inventoryScore = 6;
  factors.push({
    id: "inventory",
    label: "Inventory",
    score: inventoryScore,
    maxScore: 15,
    explanation:
      input.inventory === 0
        ? "Out of stock — cannot fulfill new orders."
        : input.daysUntilStockout != null
          ? `${input.inventory} units · ~${input.daysUntilStockout} days of cover.`
          : `${input.inventory} units on hand.`,
  });

  let trendScore = 8;
  if (input.revenueGrowthPct != null) {
    if (input.revenueGrowthPct > 15) trendScore = 10;
    else if (input.revenueGrowthPct > 0) trendScore = 8;
    else if (input.revenueGrowthPct > -10) trendScore = 5;
    else trendScore = 2;
  }
  factors.push({
    id: "demand",
    label: "Demand Trend",
    score: trendScore,
    maxScore: 10,
    explanation:
      input.revenueGrowthPct != null
        ? `Revenue ${input.revenueGrowthPct >= 0 ? "up" : "down"} ${Math.abs(input.revenueGrowthPct)}% vs prior 30 days.`
        : "Insufficient history for trend comparison.",
  });

  return factors;
}

export function computeProductHealthScore(input: {
  marginPct: number;
  productRoas: number | null;
  revenueGrowthPct: number | null;
  refundRatePct: number;
  daysUntilStockout: number | null;
  inventory: number;
  unitsSold: number;
  netProfit: number;
}): { score: number; label: ProductIntelligenceProfile["healthLabel"] } {
  let score = 50;

  if (input.netProfit > 0) score += 15;
  else score -= 25;

  if (input.marginPct >= 45) score += 15;
  else if (input.marginPct >= 25) score += 8;
  else if (input.marginPct < 15) score -= 10;

  if (input.productRoas != null) {
    if (input.productRoas >= 3) score += 12;
    else if (input.productRoas >= 1.5) score += 6;
    else if (input.productRoas < 1) score -= 8;
  }

  if (input.revenueGrowthPct != null) {
    if (input.revenueGrowthPct > 15) score += 10;
    else if (input.revenueGrowthPct > 0) score += 4;
    else if (input.revenueGrowthPct < -10) score -= 8;
  }

  if (input.refundRatePct > 8) score -= 12;
  else if (input.refundRatePct > 4) score -= 5;

  if (input.daysUntilStockout != null) {
    if (input.daysUntilStockout <= 7) score -= 10;
    else if (input.daysUntilStockout <= 14) score -= 4;
  }

  if (input.inventory > 80 && input.unitsSold < 15) score -= 8;

  score = Math.max(0, Math.min(100, Math.round(score)));

  let label: ProductIntelligenceProfile["healthLabel"] = "Fair";
  if (score >= 80) label = "Excellent";
  else if (score >= 60) label = "Good";
  else if (score < 40) label = "Poor";

  return { score, label };
}
