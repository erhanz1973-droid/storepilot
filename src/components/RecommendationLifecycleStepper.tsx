import {
  LIFECYCLE_STAGES,
  lifecycleStageIndex,
  resolveRecommendationStatus,
  toLifecycleStage,
} from "@/lib/recommendations/lifecycle";
import type { Recommendation, RecommendationStatus } from "@/lib/types";

type Props = {
  recommendation: Recommendation;
  approvalStatus?: RecommendationStatus;
};

export function RecommendationLifecycleStepper({ recommendation, approvalStatus }: Props) {
  const status = resolveRecommendationStatus(recommendation, approvalStatus);
  const stage = toLifecycleStage(status);
  const activeIndex = lifecycleStageIndex(status);

  return (
    <div className="lifecycle-stepper" aria-label="Recommendation lifecycle">
      {LIFECYCLE_STAGES.map((step, index) => {
        const isComplete = index < activeIndex;
        const isCurrent = step.key === stage;
        const isUpcoming = index > activeIndex;

        return (
          <div
            key={step.key}
            className={[
              "lifecycle-step",
              isComplete ? "lifecycle-step-complete" : "",
              isCurrent ? "lifecycle-step-current" : "",
              isUpcoming ? "lifecycle-step-upcoming" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <div className="lifecycle-step-dot" aria-hidden />
            <span className="lifecycle-step-label">{step.label}</span>
            {index < LIFECYCLE_STAGES.length - 1 && (
              <div className="lifecycle-step-connector" aria-hidden />
            )}
          </div>
        );
      })}
    </div>
  );
}
