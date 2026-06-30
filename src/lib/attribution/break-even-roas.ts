import type { ProfitPeriodMetrics } from "@/lib/profit/types";

export type DynamicBreakEvenInput = {
  revenue: number;
  grossProfit: number;
  shippingCost: number;
  transactionFees: number;
  refunds: number;
  /** Desired net profit as % of revenue (merchant target) */
  targetProfitMarginPct?: number;
};

export type BreakEvenRoasModel = {
  breakEvenRoas: number;
  grossMarginPct: number;
  shippingPct: number;
  feesPct: number;
  refundPct: number;
  targetProfitMarginPct: number;
  contributionMarginPct: number;
  summary: string;
};

export function computeDynamicBreakEvenRoas(
  input: DynamicBreakEvenInput,
): BreakEvenRoasModel | null {
  const revenue = input.revenue;
  if (revenue <= 0) return null;

  const grossMarginPct = (input.grossProfit / revenue) * 100;
  const shippingPct = (input.shippingCost / revenue) * 100;
  const feesPct = (input.transactionFees / revenue) * 100;
  const refundPct = (input.refunds / revenue) * 100;
  const targetProfitMarginPct = input.targetProfitMarginPct ?? 10;

  const contributionMarginPct =
    grossMarginPct - shippingPct - feesPct - refundPct - targetProfitMarginPct;

  if (contributionMarginPct <= 0) return null;

  const breakEvenRoas = Math.round((100 / contributionMarginPct) * 100) / 100;

  return {
    breakEvenRoas,
    grossMarginPct: Math.round(grossMarginPct * 10) / 10,
    shippingPct: Math.round(shippingPct * 10) / 10,
    feesPct: Math.round(feesPct * 10) / 10,
    refundPct: Math.round(refundPct * 10) / 10,
    targetProfitMarginPct,
    contributionMarginPct: Math.round(contributionMarginPct * 10) / 10,
    summary: `Break-even ROAS ${breakEvenRoas.toFixed(2)} = 1 ÷ ${(contributionMarginPct / 100).toFixed(2)} contribution margin after COGS (${grossMarginPct.toFixed(1)}%), shipping (${shippingPct.toFixed(1)}%), fees (${feesPct.toFixed(1)}%), refunds (${refundPct.toFixed(1)}%), and ${targetProfitMarginPct}% target profit.`,
  };
}

export function breakEvenFromProfitPeriod(
  period: ProfitPeriodMetrics,
  targetProfitMarginPct?: number,
): BreakEvenRoasModel | null {
  return computeDynamicBreakEvenRoas({
    revenue: period.revenue,
    grossProfit: period.grossProfit,
    shippingCost: period.shippingCost,
    transactionFees: period.transactionFees,
    refunds: period.refunds,
    targetProfitMarginPct,
  });
}

export function roasGapPct(currentRoas: number, breakEvenRoas: number): number {
  if (breakEvenRoas <= 0) return 0;
  return Math.round((1 - currentRoas / breakEvenRoas) * 100);
}

/** @deprecated Use computeDynamicBreakEvenRoas */
export function estimateBreakEvenRoas(grossMarginRate: number): number | null {
  if (grossMarginRate <= 0) return null;
  return Math.round((1 / grossMarginRate) * 100) / 100;
}
