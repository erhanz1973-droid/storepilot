import type { StrategyEstimate } from "@/lib/decisions/product-economics";
import type { MerchantMode } from "@/lib/decisions/merchant-mode";
import { MERCHANT_MODE_LABELS } from "@/lib/decisions/merchant-mode";

function formatUsd(amount: number): string {
  return amount.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

export function buildStrategyExplanation(input: {
  recommended: StrategyEstimate;
  runnerUp?: StrategyEstimate;
  rejectedHighRevenue?: StrategyEstimate;
  merchantMode: MerchantMode;
}): string {
  const { recommended, runnerUp, rejectedHighRevenue, merchantMode } = input;
  const lines: string[] = [
    `Recommended: ${recommended.label}`,
    "",
    "Reason:",
  ];

  if (rejectedHighRevenue && rejectedHighRevenue.expectedRevenue > recommended.expectedRevenue) {
    lines.push(
      `${rejectedHighRevenue.label} is projected to increase revenue by ${formatUsd(rejectedHighRevenue.expectedRevenue - recommended.expectedRevenue)} more, but reduce net profit by ${formatUsd(recommended.expectedNetProfit - rejectedHighRevenue.expectedNetProfit)}.`,
      "",
    );
  }

  lines.push(recommended.reasoning);

  if (runnerUp) {
    lines.push(
      "",
      `Compared with ${runnerUp.label}: expected net profit is ${formatUsd(recommended.expectedNetProfit - runnerUp.expectedNetProfit)} higher while clearing ~${Math.round(recommended.inventoryReduction - runnerUp.inventoryReduction)} additional units.`,
    );
  }

  lines.push(
    "",
    `Mode: ${MERCHANT_MODE_LABELS[merchantMode]} — ranking prioritizes expected net profit, inventory impact, and cash flow over revenue alone.`,
  );

  return lines.join("\n");
}

export function buildProfitAwareSummary(estimate: StrategyEstimate): string {
  return `Expected ${formatUsd(estimate.expectedNetProfit)} net profit · ${formatUsd(estimate.expectedRevenue)} revenue · ${Math.round(estimate.inventoryReduction)} units cleared · ${Math.round(estimate.confidence * 100)}% confidence`;
}
