import { statusIsTrusted } from "./freshness";
import type { FinancialTrustScore, RealityKpiResult } from "./types";
import { VALIDATION_STATUS_LABEL } from "./types";

/**
 * Financial Trust Score = share of eligible KPIs that are Verified or Within Tolerance.
 * Missing COGS / profit-sensitive gaps mark profit estimates provisional.
 */
export function buildFinancialTrustScore(results: RealityKpiResult[]): FinancialTrustScore {
  const eligible = results.filter((r) => r.status !== "cannot_validate");
  const verifiedCount = results.filter((r) => r.status === "verified").length;
  const withinToleranceCount = results.filter((r) => r.status === "within_tolerance").length;
  const trustedCount = results.filter((r) => statusIsTrusted(r.status)).length;

  const unverified = results
    .filter((r) => !statusIsTrusted(r.status))
    .map((r) => ({
      kpiId: r.kpiId,
      label: r.label,
      status: r.status,
      reason: r.reason ?? VALIDATION_STATUS_LABEL[r.status],
    }));

  const provisionalProfitEstimates = results.some(
    (r) =>
      r.profitSensitive &&
      (r.status === "missing_source" ||
        r.status === "cannot_validate" ||
        r.status === "needs_investigation"),
  );

  const totalEligible = Math.max(1, eligible.length);
  const scorePct = Math.round((trustedCount / totalEligible) * 1000) / 10;

  const summary =
    unverified.length === 0
      ? `All ${eligible.length} reconciliable KPIs verified or within tolerance.`
      : `${trustedCount} / ${eligible.length} KPIs trusted. ${unverified.length} need attention.`;

  return {
    scorePct,
    verifiedCount,
    withinToleranceCount,
    totalEligible: eligible.length,
    unverified,
    provisionalProfitEstimates,
    summary,
  };
}
