import { FORMULA_ENGINE_VERSION } from "../version";
import type { CalculationStep, ExplainedValue } from "./types";

export function explainedValue(input: {
  value: number | null;
  formula: string;
  formulaId: string;
  inputs: Record<string, number | string | null | undefined>;
  intermediateSteps: CalculationStep[];
  dataSources?: string[];
  assumptions?: string[];
  warnings?: string[];
  lastUpdatedAt?: string | null;
  confidencePct?: number | null;
}): ExplainedValue {
  return {
    ...input,
    formulaVersion: FORMULA_ENGINE_VERSION,
  };
}

export function currencyStep(
  label: string,
  value: number,
  op: CalculationStep["op"] = "input",
  opts?: { source?: string; assumed?: boolean },
): CalculationStep {
  return {
    label,
    value,
    unit: "currency",
    op,
    source: opts?.source,
    assumed: opts?.assumed,
  };
}
