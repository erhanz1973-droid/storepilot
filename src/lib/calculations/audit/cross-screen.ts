import type { DecisionImpact } from "../impact/engine";
import type { CrossScreenSurfaces, CrossScreenValidationResult } from "./types";

/**
 * Cross-screen validation: every surface must show the same DecisionImpact hero/net values.
 * FAIL if any surface differs.
 */
export function validateCrossScreenImpact(
  impact: DecisionImpact,
  surfaces: Partial<CrossScreenSurfaces> & { executiveHero: number; approvalSummary: number },
  opts?: { metric?: "businessRecovery" | "netProfitImpact" },
): CrossScreenValidationResult {
  const metric = opts?.metric ?? "netProfitImpact";
  const expected = metric === "businessRecovery" ? impact.businessRecovery : impact.netProfitImpact;

  const full: CrossScreenSurfaces = {
    executiveHero: surfaces.executiveHero,
    approvalSummary: surfaces.approvalSummary,
    story: surfaces.story,
    askAi: surfaces.askAi,
    history: surfaces.history,
  };

  const mismatches: CrossScreenValidationResult["mismatches"] = [];

  (Object.keys(full) as (keyof CrossScreenSurfaces)[]).forEach((key) => {
    const v = full[key];
    if (v == null) return;
    if (Math.round(v) !== Math.round(expected)) {
      mismatches.push({ surface: key, value: v });
    }
  });

  return {
    ok: mismatches.length === 0,
    expected,
    surfaces: full,
    mismatches,
  };
}

/** Assert executive presentation hero matches impact (business recovery). */
export function assertExecutiveMatchesImpact(
  impact: DecisionImpact,
  executiveHeroAmount: number,
): void {
  if (Math.round(executiveHeroAmount) !== Math.round(impact.businessRecovery)) {
    throw new Error(
      `Cross-screen FAIL: Executive hero ${executiveHeroAmount} !== DecisionImpact.businessRecovery ${impact.businessRecovery}`,
    );
  }
}

export function assertApprovalMatchesImpact(
  impact: DecisionImpact,
  approvalNetProfit: number,
): void {
  if (Math.round(approvalNetProfit) !== Math.round(impact.netProfitImpact)) {
    throw new Error(
      `Cross-screen FAIL: Approval net ${approvalNetProfit} !== DecisionImpact.netProfitImpact ${impact.netProfitImpact}`,
    );
  }
}
