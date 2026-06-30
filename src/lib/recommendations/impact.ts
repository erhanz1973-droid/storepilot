import type { AnalyzerOutput, Recommendation } from "@/lib/types";
import { parseRevenueImpact } from "@/lib/approvals/revenue";

export function hasMeasurableImpact(output: AnalyzerOutput): boolean {
  if (output.financialImpact) {
    const fi = output.financialImpact;
    if (
      (fi.estimatedMonthlyProfitIncrease ?? 0) > 0 ||
      (fi.estimatedMonthlyRevenueIncrease ?? 0) > 0 ||
      (fi.estimatedMonthlyCostSavings ?? 0) > 0
    ) {
      return true;
    }
  }
  return parseRevenueImpact(output.expectedImpact) > 0;
}

export function recommendationHasMeasurableImpact(rec: Recommendation): boolean {
  return parseRevenueImpact(rec.expectedImpact) > 0;
}

export function filterMeasurableRecommendations(outputs: AnalyzerOutput[]): AnalyzerOutput[] {
  return outputs.filter(hasMeasurableImpact);
}
