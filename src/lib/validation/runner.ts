import { listStoredRecommendations } from "@/lib/db/recommendations";
import { resolveActiveStoreId } from "@/lib/store/context";
import { validateAttributionConfidence } from "./attribution";
import { validateAllRecommendations } from "./ai-reasoning";
import { validateIntegrations } from "./integrations";
import { validateAppStoreReadiness } from "./app-store-readiness";
import { validateMetricRegistry } from "./metric-validation";
import {
  runPerformanceBenchmarks,
  validateProfitEngine,
  validateRoasEngine,
} from "./performance";
import type { GoNoGoChecklist, ValidationCheck, ValidationReport } from "./types";

function buildGoNoGo(checks: ValidationCheck[]): GoNoGoChecklist {
  const profitFails = checks.filter((c) => c.suite === "profit" && c.status === "fail");
  const roasFails = checks.filter((c) => c.suite === "roas" && c.status === "fail");
  const attrFails = checks.filter((c) => c.suite === "attribution" && c.status === "fail");
  const aiFails = checks.filter((c) => c.suite === "ai_reasoning" && c.status === "fail");
  const perfWarns = checks.filter(
    (c) => c.suite === "performance" && (c.status === "fail" || c.status === "warn"),
  );

  const blockers: string[] = [];
  if (profitFails.length) blockers.push(`${profitFails.length} profit calculation mismatch(es)`);
  if (roasFails.length) blockers.push(`${roasFails.length} ROAS mismatch(es)`);
  if (attrFails.length) blockers.push(`${attrFails.length} attribution confidence issue(s)`);
  if (aiFails.length) blockers.push(`${aiFails.length} unsupported AI recommendation(s)`);
  if (perfWarns.length) blockers.push(`${perfWarns.length} performance warning(s)`);

  const profitAccurate = profitFails.length === 0;
  const roasAccurate = roasFails.length === 0;
  const attributionConfidenceCorrect = attrFails.length === 0;
  const aiEvidenceBased = aiFails.length === 0;
  const performanceAcceptable = perfWarns.length === 0;

  return {
    profitAccurate,
    roasAccurate,
    attributionConfidenceCorrect,
    aiEvidenceBased,
    performanceAcceptable,
    readyForLaunch:
      profitAccurate &&
      roasAccurate &&
      attributionConfidenceCorrect &&
      aiEvidenceBased &&
      performanceAcceptable,
    blockers,
  };
}

export async function runValidationSuite(options?: {
  storeId?: string;
  includeIntegrations?: boolean;
}): Promise<ValidationReport> {
  const started = performance.now();
  const checks: ValidationCheck[] = [];

  checks.push(...validateProfitEngine());
  checks.push(...validateRoasEngine());
  checks.push(...validateAttributionConfidence());
  checks.push(...validateAppStoreReadiness());
  checks.push(...validateMetricRegistry());

  const { benchmarks, checks: perfChecks } = runPerformanceBenchmarks();
  checks.push(...perfChecks);

  if (options?.includeIntegrations !== false) {
    checks.push(...(await validateIntegrations()));
  }

  const storeId = options?.storeId ?? (await resolveActiveStoreId());
  const recommendations = await listStoredRecommendations(storeId);
  checks.push(...validateAllRecommendations(recommendations));

  const passed = checks.filter((c) => c.status === "pass").length;
  const failed = checks.filter((c) => c.status === "fail").length;
  const warned = checks.filter((c) => c.status === "warn").length;
  const skipped = checks.filter((c) => c.status === "skip").length;

  return {
    runAt: new Date().toISOString(),
    durationMs: Math.round(performance.now() - started),
    checks,
    passed,
    failed,
    warned,
    skipped,
    goNoGo: buildGoNoGo(checks),
    performance: benchmarks,
  };
}

let lastReport: ValidationReport | null = null;

export function getLastValidationReport(): ValidationReport | null {
  return lastReport;
}

export function cacheValidationReport(report: ValidationReport): void {
  lastReport = report;
}
