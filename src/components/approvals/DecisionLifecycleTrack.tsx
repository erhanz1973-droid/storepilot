import {
  DECISION_TRACK_STAGES,
  decisionTrackIndex,
  toDecisionTrackStage,
} from "@/lib/recommendations/decision-lifecycle";
import type { RecommendationStatus } from "@/lib/types";

export function DecisionLifecycleTrack({ status }: { status: RecommendationStatus }) {
  const stage = toDecisionTrackStage(status);
  const activeIndex = decisionTrackIndex(status);

  return (
    <div className="decision-lifecycle-track" aria-label="Decision lifecycle">
      {DECISION_TRACK_STAGES.map((step, index) => {
        const isComplete = index < activeIndex;
        const isCurrent = step.key === stage;
        const isUpcoming = index > activeIndex;

        return (
          <div
            key={step.key}
            className={[
              "decision-lifecycle-step",
              isComplete ? "is-complete" : "",
              isCurrent ? "is-current" : "",
              isUpcoming ? "is-upcoming" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <div className="decision-lifecycle-dot" aria-hidden />
            <span className="decision-lifecycle-label">{step.label}</span>
            {index < DECISION_TRACK_STAGES.length - 1 && (
              <div className="decision-lifecycle-connector" aria-hidden />
            )}
          </div>
        );
      })}
    </div>
  );
}
