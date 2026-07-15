import { calculateDecisionImpactFromRecommendation } from "@/lib/impact/decision-impact";
import type { Opportunity, Recommendation } from "@/lib/types";

export type RevenueImpactEstimate = {
  monthlyRevenue: number;
  monthlyProfit: number;
  confidencePct: number;
  label: string;
};

export function estimateFromOpportunity(
  opportunity: Opportunity,
): RevenueImpactEstimate {
  const monthlyRevenue = opportunity.estimatedMonthlyRevenueImpact;
  const monthlyProfit = opportunity.estimatedMonthlyNetProfitImpact;
  return {
    monthlyRevenue,
    monthlyProfit,
    confidencePct: Math.round(opportunity.confidenceScore * 100),
    label: formatImpactLabel(monthlyRevenue, monthlyProfit),
  };
}

export function estimateFromRecommendation(
  rec: Recommendation,
  netMarginPct?: number,
): RevenueImpactEstimate {
  const impact = calculateDecisionImpactFromRecommendation(rec, netMarginPct);
  const monthlyRevenue = impact.revenueRecovered ?? impact.advertisingSavings ?? impact.sourceAmount;
  const monthlyProfit = impact.netProfitImpact;
  return {
    monthlyRevenue,
    monthlyProfit,
    confidencePct: impact.confidence,
    label: formatImpactLabel(monthlyRevenue, monthlyProfit),
  };
}

export function formatImpactLabel(revenue: number, profit: number): string {
  if (profit > 0) return `+$${profit.toLocaleString()}/mo profit`;
  if (revenue > 0) return `+$${revenue.toLocaleString()}/mo revenue`;
  return "Operational efficiency gain";
}

export function formatCurrency(amount: number): string {
  const prefix = amount >= 0 ? "+" : "";
  return `${prefix}$${Math.abs(amount).toLocaleString()}`;
}
