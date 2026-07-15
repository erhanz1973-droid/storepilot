/**
 * Compare StorePilot outputs vs independent / locked expectations.
 */

export type ToleranceMode = "exact" | "relative";

export type CompareOpts = {
  /** Absolute tolerance for money-like decimals (default 0) */
  abs?: number;
  /** Relative tolerance e.g. 0.01 = 1% — only when mode is relative */
  rel?: number;
  mode?: ToleranceMode;
};

export type CompareResult = {
  ok: boolean;
  metric: string;
  expected: number | null;
  actual: number | null;
  delta: number | null;
  message?: string;
};

export function nearlyEqual(
  actual: number | null | undefined,
  expected: number | null | undefined,
  opts: CompareOpts = {},
): boolean {
  if (actual == null && expected == null) return true;
  if (actual == null || expected == null) return false;
  if (!Number.isFinite(actual) || !Number.isFinite(expected)) return false;

  const mode = opts.mode ?? "exact";
  const abs = opts.abs ?? 0;
  const delta = Math.abs(actual - expected);

  if (mode === "exact") {
    return delta <= abs + Number.EPSILON * 8;
  }

  const rel = opts.rel ?? 0.01;
  if (expected === 0) return delta <= abs;
  return delta <= Math.max(abs, Math.abs(expected) * rel);
}

export function compareMetric(
  metric: string,
  actual: number | null | undefined,
  expected: number | null | undefined,
  opts?: CompareOpts,
): CompareResult {
  const ok = nearlyEqual(actual, expected, opts);
  const a = actual ?? null;
  const e = expected ?? null;
  const delta = a != null && e != null ? a - e : null;
  return {
    ok,
    metric,
    expected: e,
    actual: a,
    delta,
    message: ok
      ? undefined
      : `${metric}: expected ${e}, got ${a} (Δ ${delta})`,
  };
}

export function assertAllMatch(results: CompareResult[]): void {
  const fails = results.filter((r) => !r.ok);
  if (fails.length === 0) return;
  throw new Error(
    `Financial verification failed:\n${fails.map((f) => `  - ${f.message}`).join("\n")}`,
  );
}
