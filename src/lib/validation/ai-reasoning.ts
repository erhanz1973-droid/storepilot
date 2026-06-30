import type { Recommendation } from "@/lib/types";
import { recommendationHasMeasurableImpact } from "@/lib/recommendations/impact";
import type { ValidationCheck } from "./types";

export function validateRecommendationEvidence(rec: Recommendation): ValidationCheck {
  const hasMetrics = rec.supportingMetrics.length > 0;
  const hasConfidence = rec.confidenceScore > 0 && rec.confidenceScore <= 1;
  const hasImpact = recommendationHasMeasurableImpact(rec) || rec.expectedImpact.length > 0;
  const hasReason = rec.reason.trim().length > 10;

  const pass = hasMetrics && hasConfidence && hasImpact && hasReason;

  return {
    id: `ai-evidence-${rec.id}`,
    suite: "ai_reasoning",
    name: `Evidence: ${rec.title.slice(0, 48)}`,
    status: pass ? "pass" : "fail",
    message: pass
      ? `${rec.supportingMetrics.length} supporting metrics, confidence ${Math.round(rec.confidenceScore * 100)}%`
      : [
          !hasMetrics && "missing supporting metrics",
          !hasConfidence && "invalid confidence score",
          !hasImpact && "missing expected impact",
          !hasReason && "missing reason",
        ]
          .filter(Boolean)
          .join("; "),
  };
}

export function validateAllRecommendations(recommendations: Recommendation[]): ValidationCheck[] {
  if (recommendations.length === 0) {
    return [
      {
        id: "ai-evidence-none",
        suite: "ai_reasoning",
        name: "Recommendation evidence",
        status: "skip",
        message: "No recommendations to validate",
      },
    ];
  }

  const checks = recommendations.map(validateRecommendationEvidence);
  const failed = checks.filter((c) => c.status === "fail");

  if (failed.length > 0) {
    checks.unshift({
      id: "ai-evidence-summary",
      suite: "ai_reasoning",
      name: "All recommendations evidence-based",
      status: "fail",
      expected: "0 unsupported",
      actual: `${failed.length} unsupported`,
      message: `${failed.length} of ${recommendations.length} recommendations lack required evidence`,
    });
  } else {
    checks.unshift({
      id: "ai-evidence-summary",
      suite: "ai_reasoning",
      name: "All recommendations evidence-based",
      status: "pass",
      message: `All ${recommendations.length} recommendations have supporting metrics, confidence, and impact`,
    });
  }

  return checks;
}
