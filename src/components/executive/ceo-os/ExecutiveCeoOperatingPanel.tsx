"use client";

import type { ExecutivePageData } from "@/lib/services/analytics";
import { ExecutiveDailyDecisionCard } from "./ExecutiveDailyDecisionCard";
import { ExecutiveSinceLastVisitCard } from "./ExecutiveSinceLastVisitCard";
import {
  ExecutiveAccountabilityCard,
  ExecutivePlannedDecisionsCard,
  ExecutiveRiskStoryCard,
  ExecutiveWatchStrip,
} from "./ExecutiveCeoOsSections";

type Props = {
  view: ExecutivePageData;
  onShowFull: () => void;
};

export function ExecutiveCeoOperatingPanel({ view, onShowFull }: Props) {
  const ceo = view.ceoOs;

  return (
    <>
      <ExecutiveWatchStrip message={ceo.watchMessage} />
      <ExecutiveDailyDecisionCard decision={ceo.dailyDecision} />
      <ExecutiveSinceLastVisitCard briefing={ceo.sinceLastVisit} />
      <ExecutiveAccountabilityCard items={ceo.accountabilityItems} />
      <ExecutiveRiskStoryCard story={ceo.riskStory} />
      <ExecutivePlannedDecisionsCard items={ceo.plannedDecisions} />

      <section className="card exec-ceo-footer">
        <p className="muted" style={{ margin: 0, fontSize: "0.9rem" }}>
          Full dashboards, KPIs, and module breakdowns are available when you need them — but today&apos;s job is one decision.
        </p>
        <button type="button" className="btn btn-ghost exec-advisor-mode-expand" onClick={onShowFull}>
          Open full analysis →
        </button>
      </section>
    </>
  );
}
