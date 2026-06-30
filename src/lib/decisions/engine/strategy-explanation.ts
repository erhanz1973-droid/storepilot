import type { StrategyComparisonResult } from "@/lib/decisions/strategy-comparison";
import type { StrategyWinnerExplanation } from "./types";

function formatUsd(amount: number): string {
  return amount.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

export function buildStrategyWinnerExplanation(
  comparison: StrategyComparisonResult,
): StrategyWinnerExplanation {
  const { recommended, runnerUp } = comparison;
  const profitDifference =
    runnerUp != null ? recommended.expectedNetProfit - runnerUp.expectedNetProfit : undefined;

  const businessReasons: string[] = [];

  if (runnerUp && profitDifference != null && profitDifference > 0) {
    businessReasons.push(
      `${recommended.label} delivers ${formatUsd(profitDifference)} more net profit than ${runnerUp.label}.`,
    );
  }

  if (recommended.expectedRevenue < (runnerUp?.expectedRevenue ?? recommended.expectedRevenue)) {
    businessReasons.push(
      "A higher-revenue alternative was rejected because acquisition and fulfillment costs would exceed incremental profit.",
    );
  }

  if (recommended.inventoryReduction > 0) {
    businessReasons.push(
      `Clears ~${Math.round(recommended.inventoryReduction)} units of tied-up inventory, improving cash flow.`,
    );
  }

  if (recommended.reasoning) {
    businessReasons.push(recommended.reasoning);
  }

  const narrative = [
    `Recommended strategy: ${recommended.label}`,
    runnerUp
      ? `Runner-up: ${runnerUp.label} (${formatUsd(runnerUp.expectedNetProfit)} net profit)`
      : null,
    profitDifference != null && profitDifference > 0
      ? `Difference: +${formatUsd(profitDifference)}`
      : null,
    "",
    comparison.explanation,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    recommendedLabel: recommended.label,
    recommendedNetProfit: recommended.expectedNetProfit,
    runnerUpLabel: runnerUp?.label,
    runnerUpNetProfit: runnerUp?.expectedNetProfit,
    profitDifference,
    narrative,
    businessReasons,
  };
}
