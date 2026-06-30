import type { QualityGateReport, ReleaseQualityThresholds } from "./types";

export const DEFAULT_RELEASE_THRESHOLDS: ReleaseQualityThresholds = {
  decisionAccuracyPct: 95,
  businessModelCompliancePct: 100,
  validationCoveragePct: 100,
  criticalScenarioPassPct: 100,
  decisionQualityPct: 90,
};

export function evaluateReleaseQualityGate(input: {
  accuracyPct: number;
  businessModelCompliancePct: number;
  validationCoveragePct: number;
  criticalScenarioPassPct: number;
  avgQualityPct: number;
  thresholds?: Partial<ReleaseQualityThresholds>;
  driftFailures?: number;
}): QualityGateReport {
  const t = { ...DEFAULT_RELEASE_THRESHOLDS, ...input.thresholds };
  const checks = [
    {
      id: "decision_accuracy",
      label: "Decision Accuracy",
      threshold: t.decisionAccuracyPct,
      actual: input.accuracyPct,
      passed: input.accuracyPct >= t.decisionAccuracyPct,
    },
    {
      id: "business_model_compliance",
      label: "Business Model Compliance",
      threshold: t.businessModelCompliancePct,
      actual: input.businessModelCompliancePct,
      passed: input.businessModelCompliancePct >= t.businessModelCompliancePct,
    },
    {
      id: "validation_coverage",
      label: "Validation Coverage",
      threshold: t.validationCoveragePct,
      actual: input.validationCoveragePct,
      passed: input.validationCoveragePct >= t.validationCoveragePct,
    },
    {
      id: "critical_scenarios",
      label: "Critical Scenario PASS",
      threshold: t.criticalScenarioPassPct,
      actual: input.criticalScenarioPassPct,
      passed: input.criticalScenarioPassPct >= t.criticalScenarioPassPct,
    },
    {
      id: "decision_quality",
      label: "Decision Quality",
      threshold: t.decisionQualityPct,
      actual: input.avgQualityPct,
      passed: input.avgQualityPct >= t.decisionQualityPct,
    },
    {
      id: "decision_drift",
      label: "No Decision Drift",
      threshold: 0,
      actual: input.driftFailures ?? 0,
      passed: (input.driftFailures ?? 0) === 0,
    },
  ];

  const passed = checks.every((c) => c.passed);
  const failedChecks = checks.filter((c) => !c.passed);

  return {
    passed,
    productionReady: passed,
    checks,
    failedChecks: failedChecks.map((c) => c.label),
    message: passed
      ? "Release quality gate passed — build is production-ready."
      : `Release blocked: ${failedChecks.map((c) => c.label).join(", ")} below threshold.`,
    evaluatedAt: new Date().toISOString(),
  };
}
