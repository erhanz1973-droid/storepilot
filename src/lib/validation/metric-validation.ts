import { METRIC_REGISTRY, registrySummary } from "./metric-registry";
import type { ValidationCheck } from "./types";

/**
 * Phase 1–2 automated checks: registry completeness and release blockers.
 */
export function validateMetricRegistry(): ValidationCheck[] {
  const checks: ValidationCheck[] = [];
  const summary = registrySummary();

  checks.push({
    id: "metric-registry-count",
    suite: "metrics",
    name: "Metric registry populated",
    status: summary.total >= 20 ? "pass" : "fail",
    actual: String(summary.total),
    message: `${summary.total} metrics documented in METRIC_REGISTRY`,
  });

  for (const metric of METRIC_REGISTRY) {
    if (!metric.codePath || !metric.calculation) {
      checks.push({
        id: `metric-incomplete-${metric.id}`,
        suite: "metrics",
        name: `${metric.label} documentation`,
        status: "fail",
        message: "Missing codePath or calculation",
      });
    }
  }

  const blocked = METRIC_REGISTRY.filter((m) => m.validationStatus === "blocked");
  for (const m of blocked) {
    checks.push({
      id: `metric-blocked-${m.id}`,
      suite: "metrics",
      name: `${m.label} — blocked`,
      status: "warn",
      message: `${m.label} blocked: ${m.varianceNotes ?? m.codePath}`,
    });
  }

  const pending = METRIC_REGISTRY.filter((m) => m.validationStatus === "pending");
  for (const m of pending) {
    checks.push({
      id: `metric-pending-${m.id}`,
      suite: "metrics",
      name: `${m.label} — pending cross-check`,
      status: "warn",
      message: m.varianceNotes ?? "Awaiting pilot store validation",
    });
  }

  checks.push({
    id: "metric-registry-rc1-gate",
    suite: "metrics",
    name: "RC1 metric gate",
    status: summary.readyForRc1 ? "pass" : "warn",
    message: summary.readyForRc1
      ? "All metrics pass or documented as estimated"
      : `${summary.blocked} blocked, ${summary.pending} pending — RC1 not ready`,
  });

  return checks;
}

export function exportValidationTableMarkdown(): string {
  const lines = [
    "# Metric Validation Table (auto-generated)",
    "",
    "| Metric | Source API | Field / Calculation | Status | Cross-check |",
    "|--------|------------|---------------------|--------|-------------|",
  ];

  for (const m of METRIC_REGISTRY) {
    const status = m.validationStatus.toUpperCase();
    const cross = m.crossCheckWith ?? "—";
    lines.push(
      `| ${m.label} | ${m.sourceApi} | ${m.calculation} | ${status} | ${cross} |`,
    );
  }

  lines.push("", `Generated from \`METRIC_REGISTRY\` (${METRIC_REGISTRY.length} entries).`);
  return lines.join("\n");
}
