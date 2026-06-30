import type { DecisionEnginePerformance } from "./types";

const TARGET_MS = 2000;

export type PerformanceMarks = {
  decisionCenterMs: number;
  mergeMs: number;
  enrichmentMs: number;
  qaMs: number;
  validationMs?: number;
  strategySimulationMs?: number;
};

export function buildPerformanceReport(
  marks: PerformanceMarks,
  startedAt: number,
): DecisionEnginePerformance {
  const totalMs = Math.round(performance.now() - startedAt);
  return {
    totalMs,
    decisionCenterMs: Math.round(marks.decisionCenterMs),
    mergeMs: Math.round(marks.mergeMs),
    enrichmentMs: Math.round(marks.enrichmentMs),
    qaMs: Math.round(marks.qaMs),
    validationMs: marks.validationMs != null ? Math.round(marks.validationMs) : undefined,
    strategySimulationMs:
      marks.strategySimulationMs != null
        ? Math.round(marks.strategySimulationMs)
        : undefined,
    targetMs: TARGET_MS,
    withinTarget: totalMs < TARGET_MS,
  };
}

export function createPerformanceTimer() {
  const startedAt = performance.now();
  const marks: Partial<PerformanceMarks> = {};

  return {
    mark<K extends keyof PerformanceMarks>(key: K, durationMs: number) {
      marks[key] = durationMs;
    },
    finish(): DecisionEnginePerformance {
      return buildPerformanceReport(marks as PerformanceMarks, startedAt);
    },
  };
}
