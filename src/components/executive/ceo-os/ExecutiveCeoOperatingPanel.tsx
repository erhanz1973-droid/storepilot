"use client";

import type { ExecutivePageData } from "@/lib/services/analytics";
import type { CampaignEntitlements } from "@/lib/billing/types";
import { PlanScaleBanner } from "@/components/billing/PlanScaleBanner";
import { ExecutiveBriefCard } from "./ExecutiveBriefCard";
import { ExecutiveDailyDecisionCard } from "./ExecutiveDailyDecisionCard";
import { ExecutiveSinceLastVisitCard } from "./ExecutiveSinceLastVisitCard";
import {
  ExecutiveAccountabilityCard,
  ExecutiveDecisionModelAccuracyCard,
  ExecutiveNotesCard,
  ExecutivePlannedDecisionsCard,
  ExecutiveRiskStoryCard,
  ExecutiveWatchStrip,
} from "./ExecutiveCeoOsSections";

type Props = {
  view: ExecutivePageData;
  onShowFull: () => void;
  planUsage?: CampaignEntitlements;
};

export function ExecutiveCeoOperatingPanel({ view, onShowFull, planUsage }: Props) {
  const ceo = view.ceoOs;

  return (
    <div className={`exec-ceo-os exec-ceo-mode-${ceo.mode.toLowerCase()}`}>
      {/* 1. Executive Brief — the first thing the CEO sees */}
      <ExecutiveBriefCard brief={ceo.executiveBrief} />

      {/* 2. Today's Executive Decision */}
      <ExecutiveDailyDecisionCard
        decision={ceo.dailyDecision}
        mode={ceo.mode}
        evidencePipeline={ceo.evidencePipeline}
        observeContext={ceo.observeContext}
        thresholdCurrent={ceo.deepAiBrief.threshold?.currentScore}
        thresholdRequired={ceo.deepAiBrief.threshold?.requiredScore}
      />

      {/* 3. Why this matters + Supporting Evidence */}
      <div className="exec-ceo-context-row" aria-label="Supporting context">
        <ExecutiveRiskStoryCard story={ceo.riskStory} />
        <ExecutiveWatchStrip status={view.aiBehavior.liveStatus} />
        <ExecutiveSinceLastVisitCard briefing={ceo.sinceLastVisit} />
        <ExecutiveAccountabilityCard items={ceo.accountabilityItems} />
      </div>

      {/* 4. Deep AI Analysis */}
      {(planUsage && !planUsage.isUnlimited) || ceo.deepAiBrief ? (
        <div className="exec-ceo-scan-row">
          <PlanScaleBanner
            entitlements={
              planUsage ?? {
                planId: "starter",
                planLabel: "Starter",
                upgradePlanLabel: "Starter",
                maxAnalyzedCampaigns: 999,
                maxDeepAnalysisCampaigns: 999,
                totalCampaigns: ceo.deepAiBrief.campaignsScanned,
                scannedCampaignCount: ceo.deepAiBrief.campaignsScanned,
                unlockedCampaignId: "",
                unlockedCampaignName: ceo.deepAiBrief.observingCampaignName ?? "",
                lockedCampaignCount: 0,
                isUnlimited: true,
              }
            }
            unlockedCampaignName={
              planUsage?.unlockedCampaignName ?? ceo.deepAiBrief.observingCampaignName ?? undefined
            }
            variant="executive"
            deepAiBrief={ceo.deepAiBrief}
          />
        </div>
      ) : null}

      {/* 5. Planned for Later */}
      <div className="exec-ceo-mid-row" aria-label="Secondary plans">
        <ExecutivePlannedDecisionsCard items={ceo.plannedDecisions} section={ceo.plannedSection} />
        <ExecutiveNotesCard notes={ceo.notes} onShowFull={onShowFull} />
        <ExecutiveDecisionModelAccuracyCard accuracy={ceo.decisionModelAccuracy} />
      </div>
    </div>
  );
}
