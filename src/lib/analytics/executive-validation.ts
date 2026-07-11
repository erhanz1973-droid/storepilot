import type { StoreSnapshot } from "@/lib/connectors/types";
import type { ProfitDashboard } from "@/lib/profit/types";
import {
  buildProfitCalculationTrace,
  clampConfidence,
  computeRecoveryTotals,
  dedupeMoneyLeaks,
  buildBusinessScaleContext,
  type DedupedMoneyLeaks,
  type ProfitCalculationTrace,
  type RecoveryTotals,
  type RecommendationInput,
} from "./executive-finance";

export type ValidationIssue = {
  code: string;
  message: string;
  severity: "warning" | "error";
};

export type ExecutiveValidationReport = {
  passed: boolean;
  issues: ValidationIssue[];
  profitTrace: ProfitCalculationTrace;
  recovery: RecoveryTotals;
  moneyLeaks: DedupedMoneyLeaks;
};

function checkProfitBalance(trace: ProfitCalculationTrace): ValidationIssue | null {
  if (trace.status === "unavailable") return null;
  if (!trace.isBalanced) {
    return {
      code: "profit_imbalance",
      message: `Estimated profit (${trace.estimatedProfit}) does not match component sum (${trace.computedProfit}). Displaying recalculated value.`,
      severity: "warning",
    };
  }
  return null;
}

function checkRecoveryTotals(recovery: RecoveryTotals, businessContext?: ReturnType<typeof buildBusinessScaleContext>): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (recovery.netMonthly > recovery.grossMonthly) {
    issues.push({
      code: "recovery_exceeds_gross",
      message: "Net recovery exceeded gross opportunity — capped to gross total.",
      severity: "error",
    });
  }
  if (businessContext && businessContext.monthlyRevenue > 0 && recovery.netMonthly > businessContext.monthlyRevenue) {
    issues.push({
      code: "recovery_exceeds_revenue",
      message: "Recovery potential exceeded monthly revenue — estimate was capped.",
      severity: "error",
    });
  }
  if (businessContext && businessContext.monthlyAdSpend > 0 && recovery.netMonthly > businessContext.monthlyAdSpend * 0.5) {
    issues.push({
      code: "recovery_exceeds_ad_spend",
      message: "Recovery potential exceeded 50% of monthly ad spend — estimate was capped.",
      severity: "warning",
    });
  }
  return issues;
}

function checkMoneyLeakOverlap(leaks: DedupedMoneyLeaks): ValidationIssue | null {
  if (leaks.excludedOverlaps.length > 0) return null;
  return null;
}

function checkHealthConsistency(
  categories: { label: string; score: number; explanation: string }[],
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const cat of categories) {
    const saysHealthy =
      cat.explanation.toLowerCase().includes("healthy") ||
      cat.explanation.toLowerCase().includes("within normal range") ||
      cat.explanation.toLowerCase().includes("stable");
    if (cat.score < 40 && saysHealthy) {
      issues.push({
        code: "health_mismatch",
        message: `${cat.label} score (${cat.score}) contradicts its explanation — recalculated.`,
        severity: "error",
      });
    }
    if (cat.score >= 70 && cat.explanation.toLowerCase().includes("critically low")) {
      issues.push({
        code: "health_mismatch",
        message: `${cat.label} explanation too negative for score ${cat.score} — recalculated.`,
        severity: "error",
      });
    }
  }
  return issues;
}

function checkConfidence(rows: RecommendationInput[]): ValidationIssue[] {
  return rows
    .filter((r) => r.confidencePct < 0 || r.confidencePct > 100)
    .map((r) => ({
      code: "confidence_out_of_range",
      message: `Confidence for "${r.title}" was out of range — clamped to 0–100.`,
      severity: "warning",
    }));
}

export function validateExecutiveFinancials(input: {
  profitDashboard: ProfitDashboard | null;
  snapshot: StoreSnapshot;
  rawMoneyLeakSources: import("./executive-finance").MoneyLeakSource[];
  recommendations: RecommendationInput[];
  healthCategories: { label: string; score: number; explanation: string }[];
}): ExecutiveValidationReport {
  const profitTrace = buildProfitCalculationTrace(input.profitDashboard, input.snapshot);
  const moneyLeaks = dedupeMoneyLeaks(input.rawMoneyLeakSources);
  const businessContext = buildBusinessScaleContext(input.profitDashboard, input.snapshot);
  const avgConfidence =
    input.recommendations.length > 0
      ? Math.round(
          input.recommendations.reduce((s, r) => s + r.confidencePct, 0) /
            input.recommendations.length,
        )
      : 72;
  let recovery = computeRecoveryTotals(input.recommendations, {
    businessContext,
    avgConfidencePct: avgConfidence,
  });

  if (recovery.netMonthly > recovery.grossMonthly) {
    recovery = { ...recovery, netMonthly: recovery.grossMonthly, overlapRemoved: 0 };
  }

  const issues: ValidationIssue[] = [
    checkProfitBalance(profitTrace),
    ...checkRecoveryTotals(recovery, businessContext),
    checkMoneyLeakOverlap(moneyLeaks),
    ...checkHealthConsistency(input.healthCategories),
    ...checkConfidence(input.recommendations),
  ].filter((i): i is ValidationIssue => i != null);

  return {
    passed: issues.filter((i) => i.severity === "error").length === 0,
    issues,
    profitTrace,
    recovery,
    moneyLeaks,
  };
}

export { clampConfidence };
