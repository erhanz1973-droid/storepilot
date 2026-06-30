import type { QualityBenchmarkSnapshot, QualityRunSummary } from "./types";

const memoryBenchmarks: QualityBenchmarkSnapshot[] = [];

export function recordQualityBenchmark(snapshot: QualityBenchmarkSnapshot): void {
  const idx = memoryBenchmarks.findIndex(
    (b) => b.releaseVersion === snapshot.releaseVersion,
  );
  if (idx >= 0) memoryBenchmarks[idx] = snapshot;
  else memoryBenchmarks.unshift(snapshot);
  if (memoryBenchmarks.length > 50) memoryBenchmarks.length = 50;
}

export function listQualityBenchmarks(): QualityBenchmarkSnapshot[] {
  return [...memoryBenchmarks];
}

export function buildBenchmarkFromRuns(
  releaseVersion: string,
  runs: QualityRunSummary[],
  gatePassed: boolean,
): QualityBenchmarkSnapshot {
  const total = runs.length || 1;
  const passCount = runs.filter((r) => r.verdict === "pass").length;
  const warnCount = runs.filter((r) => r.verdict === "warn").length;
  const failCount = runs.filter((r) => r.verdict === "fail").length;

  const avg = (fn: (r: QualityRunSummary) => number) =>
    Math.round(runs.reduce((s, r) => s + fn(r), 0) / total);

  return {
    releaseVersion,
    accuracyPct: Math.round((passCount / total) * 1000) / 10,
    passCount,
    warnCount,
    failCount,
    avgConfidencePct: avg((r) => r.avgConfidencePct),
    avgExplainabilityPct: avg((r) => r.avgExplainabilityPct),
    avgValidationPct: avg((r) => r.avgValidationPct),
    avgQualityPct: avg((r) => r.avgQualityPct),
    gatePassed,
    createdAt: new Date().toISOString(),
    trend:
      memoryBenchmarks.length > 0
        ? memoryBenchmarks[0].accuracyPct <
          Math.round((passCount / total) * 1000) / 10
          ? "increasing"
          : memoryBenchmarks[0].accuracyPct >
              Math.round((passCount / total) * 1000) / 10
            ? "decreasing"
            : "stable"
        : "stable",
  };
}

export function accuracyTrend(): "increasing" | "decreasing" | "stable" {
  if (memoryBenchmarks.length < 2) return "stable";
  const latest = memoryBenchmarks[0].accuracyPct;
  const prev = memoryBenchmarks[1].accuracyPct;
  if (latest > prev + 0.5) return "increasing";
  if (latest < prev - 0.5) return "decreasing";
  return "stable";
}
