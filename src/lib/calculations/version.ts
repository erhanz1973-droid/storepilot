/**
 * Formula Engine version — bump when any production formula changes.
 * Historical DecisionImpact / CalculationAudit rows keep their formulaVersion.
 */
export const FORMULA_ENGINE_VERSION = "1.3.2";

export function isFormulaVersionCompatible(
  stored: string,
  current: string = FORMULA_ENGINE_VERSION,
): boolean {
  const [aMajor] = stored.split(".").map(Number);
  const [bMajor] = current.split(".").map(Number);
  return aMajor === bMajor;
}
