import type { MerchantMode } from "@/lib/decisions/merchant-mode";
import { scoreStrategyForMode } from "@/lib/decisions/merchant-mode";
import {
  type ProductEconomicsInput,
  type StrategyEstimate,
  simulateBogoHalf,
  simulateBundleOffer,
  simulateDiscount,
  simulateDoNothing,
  simulateIncreaseAds,
  simulatePauseAds,
} from "@/lib/decisions/product-economics";
import { buildStrategyExplanation } from "@/lib/decisions/explainability";
import type { ProfitDashboard } from "@/lib/profit/types";

export type RankedStrategy = StrategyEstimate & {
  compositeScore: number;
};

export type StrategyComparisonResult = {
  productId: string;
  productTitle: string;
  merchantMode: MerchantMode;
  strategies: RankedStrategy[];
  recommended: RankedStrategy;
  runnerUp?: RankedStrategy;
  explanation: string;
  expectedBusinessImpact: string;
};

function rankStrategies(
  strategies: StrategyEstimate[],
  mode: MerchantMode,
): RankedStrategy[] {
  return strategies
    .map((strategy) => ({
      ...strategy,
      compositeScore: scoreStrategyForMode(mode, {
        netProfit: strategy.expectedNetProfit,
        revenue: strategy.expectedRevenue,
        inventoryReduction: strategy.inventoryReduction,
        cashRecovery: strategy.cashFlowImpact,
        unitsSold: strategy.expectedUnitsSold,
        roasImpact: strategy.roasImpact,
      }),
    }))
    .sort((a, b) => {
      if (b.compositeScore !== a.compositeScore) return b.compositeScore - a.compositeScore;
      return b.expectedNetProfit - a.expectedNetProfit;
    });
}

export function compareSlowProductStrategies(input: {
  product: ProductEconomicsInput;
  profitDashboard?: ProfitDashboard | null;
  merchantMode?: MerchantMode;
}): StrategyComparisonResult {
  const mode = input.merchantMode ?? "profit";
  const { product, profitDashboard } = input;

  const raw: StrategyEstimate[] = [
    simulateDiscount(product, 0.15, profitDashboard),
    simulateDiscount(product, 0.1, profitDashboard),
    simulateBundleOffer(product, profitDashboard),
    simulateBogoHalf(product, profitDashboard),
    simulateIncreaseAds(product, profitDashboard),
    simulatePauseAds(product, profitDashboard),
    simulateDoNothing(product, profitDashboard),
  ];

  const strategies = rankStrategies(raw, mode);
  const recommended = strategies[0];
  const runnerUp = strategies[1];
  const highestRevenue = [...strategies].sort((a, b) => b.expectedRevenue - a.expectedRevenue)[0];

  const rejectedHighRevenue =
    highestRevenue.strategyId !== recommended.strategyId &&
    highestRevenue.expectedNetProfit < recommended.expectedNetProfit
      ? highestRevenue
      : undefined;

  const explanation = buildStrategyExplanation({
    recommended,
    runnerUp,
    rejectedHighRevenue,
    merchantMode: mode,
  });

  const expectedBusinessImpact = [
    `${recommended.label} delivers ~$${Math.round(recommended.expectedNetProfit).toLocaleString()} net profit / 30d`,
    `${Math.round(recommended.inventoryReduction)} units cleared`,
    `$${Math.round(recommended.cashFlowImpact).toLocaleString()} cash flow impact`,
  ].join(" · ");

  return {
    productId: product.productId,
    productTitle: product.title,
    merchantMode: mode,
    strategies,
    recommended,
    runnerUp,
    explanation,
    expectedBusinessImpact,
  };
}

export function simulateCustomDiscount(input: {
  product: ProductEconomicsInput;
  discountPct: number;
  profitDashboard?: ProfitDashboard | null;
  merchantMode?: MerchantMode;
}): StrategyComparisonResult {
  const single = simulateDiscount(input.product, input.discountPct, input.profitDashboard);
  const ranked = rankStrategies([single], input.merchantMode ?? "profit");
  const recommended = ranked[0];

  return {
    productId: input.product.productId,
    productTitle: input.product.title,
    merchantMode: input.merchantMode ?? "profit",
    strategies: ranked,
    recommended,
    explanation: buildStrategyExplanation({
      recommended,
      merchantMode: input.merchantMode ?? "profit",
    }),
    expectedBusinessImpact: `Custom ${Math.round(input.discountPct * 100)}% discount scenario`,
  };
}
