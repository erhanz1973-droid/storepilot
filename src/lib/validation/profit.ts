import type { ProfitOrderRollups } from "@/lib/connectors/types";
import {
  DEFAULT_TRANSACTION_FEE_FIXED,
  DEFAULT_TRANSACTION_FEE_RATE,
} from "@/lib/profit/constants";
import type { ProfitWindow } from "@/lib/profit/types";
import type { ValidationCheck } from "./types";

export function manualNetProfit(
  bucket: ProfitOrderRollups[ProfitWindow],
  adSpend: number,
  operationalCost = 0,
): number {
  const transactionFees =
    Math.round(
      (bucket.revenue * DEFAULT_TRANSACTION_FEE_RATE +
        bucket.orders * DEFAULT_TRANSACTION_FEE_FIXED) *
        100,
    ) / 100;

  return (
    Math.round(
      (bucket.revenue -
        bucket.cogs -
        bucket.shipping -
        bucket.refunds -
        transactionFees -
        adSpend -
        operationalCost) *
        100,
    ) / 100
  );
}

export function manualGrossProfit(bucket: ProfitOrderRollups[ProfitWindow]): number {
  return Math.round((bucket.revenue - bucket.cogs) * 100) / 100;
}

export function compareProfitValues(
  label: string,
  expected: number,
  actual: number,
  tolerance = 0,
): ValidationCheck {
  const diff = Math.abs(expected - actual);
  const pass = diff <= tolerance;
  return {
    id: `profit-${label.replace(/\s+/g, "-").toLowerCase()}`,
    suite: "profit",
    name: label,
    status: pass ? "pass" : "fail",
    expected: expected.toFixed(2),
    actual: actual.toFixed(2),
    message: pass
      ? `Net profit matches manual calculation (${expected.toFixed(2)})`
      : `Mismatch: expected ${expected.toFixed(2)}, got ${actual.toFixed(2)} (Δ ${diff.toFixed(2)})`,
  };
}
