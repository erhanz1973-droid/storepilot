import type { CeoBrief } from "@/lib/analytics/executive-advisor";
import { EXEC_METRIC_ICONS } from "./executive-metric-icons";

export function ExecutiveAiGreetingCard({
  brief,
  hidePriority = false,
}: {
  brief: CeoBrief;
  hidePriority?: boolean;
}) {
  return (
    <section className="exec-advisor-greeting card">
      <div className="exec-advisor-greeting-header">
        <span className="exec-advisor-greeting-icon" aria-hidden>
          {EXEC_METRIC_ICONS.ai}
        </span>
        <div>
          <p className="exec-advisor-greeting-title">{brief.greeting}</p>
          <p className="muted exec-advisor-greeting-sub">Your AI executive advisor</p>
        </div>
      </div>
      <div className="exec-advisor-greeting-body">
        {brief.headline && (
          <p className="exec-advisor-greeting-headline">{brief.headline}</p>
        )}
        {brief.conversation
          .filter((line) => line !== brief.headline)
          .map((line) => (
            <p key={line} className="exec-advisor-ceo-line">
              {line}
            </p>
          ))}
      </div>
      {!hidePriority && brief.todayPriority && (
        <p className="exec-advisor-greeting-priority">
          <span className="exec-metric-icon" aria-hidden>
            {EXEC_METRIC_ICONS.threat}
          </span>
          Priority today: <strong>{brief.todayPriority}</strong>
        </p>
      )}
      {brief.closingLine && (
        <p className="exec-advisor-ceo-closing">{brief.closingLine}</p>
      )}
    </section>
  );
}
