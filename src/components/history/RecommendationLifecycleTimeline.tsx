import { HISTORY_LIFECYCLE_STAGES } from "@/lib/history/lifecycle";

export function RecommendationLifecycleTimeline({ activeIndex }: { activeIndex: number }) {
  return (
    <div className="rec-lifecycle-timeline" aria-label="Recommendation lifecycle">
      {HISTORY_LIFECYCLE_STAGES.map((stage, index) => {
        const isComplete = index < activeIndex;
        const isCurrent = index === activeIndex;
        return (
          <div key={stage.key} className="rec-lifecycle-step-wrap">
            <div
              className={[
                "rec-lifecycle-step",
                isComplete ? "is-complete" : "",
                isCurrent ? "is-current" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <span className="rec-lifecycle-dot" />
              <span className="rec-lifecycle-label">{stage.label}</span>
            </div>
            {index < HISTORY_LIFECYCLE_STAGES.length - 1 && (
              <span className="rec-lifecycle-arrow" aria-hidden>
                ↓
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
