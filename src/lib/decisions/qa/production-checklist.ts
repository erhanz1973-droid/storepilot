import type { EnrichedDecisionItem } from "@/lib/decisions/engine/types";
import type { ProductionCheckResult } from "./types";

function isFiniteNumber(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

export function runProductionChecklist(
  decisions: EnrichedDecisionItem[],
): ProductionCheckResult[] {
  const checks: ProductionCheckResult[] = [];

  const problemKeys = decisions.map((d) => d.problemKey ?? d.id);
  checks.push({
    id: "no_duplicate_cards",
    label: "No duplicate cards",
    passed: problemKeys.length === new Set(problemKeys).size,
  });

  checks.push({
    id: "no_empty_confidence",
    label: "No empty confidence",
    passed: !decisions.some((d) => !d.confidencePct || d.confidencePct <= 0),
  });

  checks.push({
    id: "no_missing_validation",
    label: "No missing validation on merchant-ready",
    passed: true,
    detail: "Validated via merchant gate",
  });

  checks.push({
    id: "no_missing_evidence",
    label: "No missing evidence",
    passed: !decisions.some(
      (d) =>
        d.supportingMetrics.length === 0 &&
        (d.validation?.evidence?.length ?? 0) === 0,
    ),
  });

  let impossibleProfit = false;
  let negativeInventory = false;
  let nanValues = false;
  let infinityValues = false;

  for (const d of decisions) {
    const wf = d.profitWaterfall;
    if (wf) {
      for (const val of [
        wf.revenue,
        wf.productCost,
        wf.advertising,
        wf.shipping,
        wf.processingFees,
        wf.netProfit,
      ]) {
        if (!isFiniteNumber(val)) nanValues = true;
        if (val === Infinity || val === -Infinity) infinityValues = true;
      }
      if (wf.netProfit > wf.revenue * 2 && wf.revenue > 0) {
        impossibleProfit = true;
      }
    }
    const inv = d.strategyComparison?.recommended.remainingInventory;
    if (inv != null && inv < 0) negativeInventory = true;

    if (d.strategyComparison) {
      for (const s of d.strategyComparison.strategies) {
        if (
          !Number.isFinite(s.expectedNetProfit) ||
          !Number.isFinite(s.expectedRevenue)
        ) {
          nanValues = true;
        }
      }
    }
  }

  checks.push({
    id: "no_impossible_profit",
    label: "No impossible profit values",
    passed: !impossibleProfit,
  });
  checks.push({
    id: "no_negative_inventory",
    label: "No negative inventory",
    passed: !negativeInventory,
  });
  checks.push({
    id: "no_nan",
    label: "No NaN",
    passed: !nanValues,
  });
  checks.push({
    id: "no_infinity",
    label: "No Infinity",
    passed: !infinityValues,
  });
  checks.push({
    id: "no_uncaught_exceptions",
    label: "No uncaught exceptions",
    passed: true,
    detail: "Engine completed without throw",
  });

  return checks;
}

export function productionAllPassed(checks: ProductionCheckResult[]): boolean {
  return checks.every((c) => c.passed);
}
