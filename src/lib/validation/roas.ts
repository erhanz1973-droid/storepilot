import type { ValidationCheck } from "./types";

export function manualRoas(revenue: number, adSpend: number): number | null {
  if (adSpend <= 0) return null;
  return Math.round((revenue / adSpend) * 100) / 100;
}

export function compareRoas(
  window: string,
  expected: number | null,
  actual: number | null,
): ValidationCheck {
  if (expected == null && actual == null) {
    return {
      id: `roas-${window}`,
      suite: "roas",
      name: `Blended ROAS (${window})`,
      status: "pass",
      message: "Both null — no ad spend in period",
    };
  }
  if (expected == null || actual == null) {
    return {
      id: `roas-${window}`,
      suite: "roas",
      name: `Blended ROAS (${window})`,
      status: "fail",
      expected: expected?.toFixed(2) ?? "null",
      actual: actual?.toFixed(2) ?? "null",
      message: "One value is null, the other is not",
    };
  }
  const diff = Math.abs(expected - actual);
  const pass = diff === 0;
  return {
    id: `roas-${window}`,
    suite: "roas",
    name: `Blended ROAS (${window})`,
    status: pass ? "pass" : "fail",
    expected: expected.toFixed(2),
    actual: actual.toFixed(2),
    message: pass
      ? `ROAS ${expected.toFixed(2)} matches manual calculation`
      : `ROAS mismatch: expected ${expected.toFixed(2)}, got ${actual.toFixed(2)}`,
  };
}
