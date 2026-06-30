import type { ProfitDashboard } from "@/lib/profit/types";

export type ChannelProfitBreakdown = {
  revenue: number;
  advertisingCost: number;
  cogs: number;
  shipping: number;
  paymentFees: number;
  netContribution: number;
};

function round(n: number): number {
  return Math.round(n);
}

/** Allocate store-level costs to a channel by revenue share; ad spend allocated separately for paid. */
export function buildChannelProfitBreakdown(input: {
  channelRevenue: number;
  storeRevenue: number;
  profitDashboard: ProfitDashboard | null | undefined;
  advertisingCost: number;
}): ChannelProfitBreakdown | null {
  if (input.channelRevenue <= 0) return null;

  const p = input.profitDashboard?.primary;
  if (!p || input.storeRevenue <= 0) {
    const margin = 0.25;
    const cogs = round(input.channelRevenue * margin * 0.5);
    const ad = round(input.advertisingCost);
    return {
      revenue: round(input.channelRevenue),
      advertisingCost: ad,
      cogs,
      shipping: round(input.channelRevenue * 0.04),
      paymentFees: round(input.channelRevenue * 0.029),
      netContribution: round(input.channelRevenue - cogs - ad - input.channelRevenue * 0.069),
    };
  }

  const share = input.channelRevenue / input.storeRevenue;
  const cogs = round(p.cogs * share);
  const shipping = round(p.shippingCost * share);
  const paymentFees = round(p.transactionFees * share);
  const advertisingCost = round(input.advertisingCost);
  const netContribution = round(
    input.channelRevenue - cogs - shipping - paymentFees - advertisingCost,
  );

  return {
    revenue: round(input.channelRevenue),
    advertisingCost,
    cogs,
    shipping,
    paymentFees,
    netContribution,
  };
}
