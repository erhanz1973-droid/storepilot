"use client";

import { useEffect, useRef } from "react";
import type { AdvertisingWorkspaceView } from "@/lib/advertising/types";
import { recordAdvertisingVisitSnapshot } from "@/actions/visit-tracking";
import { AccountWideSummaryCard } from "./AccountWideSummaryCard";
import { DailyPriorityCard } from "./DailyPriorityCard";
import { SinceLastVisitBriefing } from "./SinceLastVisitBriefing";
import { AIAdvertisingManagerSummary } from "./AIAdvertisingManagerSummary";
import { TrustEnginePanelView } from "./TrustEnginePanel";
import {
  AiAccountabilitySection,
  CrossModuleIntelligencePanel,
  LearningPersonalizationPanel,
  PredictionTrackRecordPanel,
} from "./AiAccountabilitySection";
import { AdvertisingHealthExplainPanel } from "./AdvertisingHealthExplainPanel";
import { CampaignSpotlightSection } from "./CampaignSpotlightSection";
import { PlatformSummaryGrid } from "./PlatformSummaryGrid";
import { CampaignWorkspaceTable } from "./CampaignWorkspaceTable";
import { AdSetAnalysisTable } from "./AdSetAnalysisTable";
import { IndividualAdsTable } from "./IndividualAdsTable";
import { CreativeIntelligenceSection } from "./CreativeIntelligenceSection";
import { AudienceAnalysisSection } from "./AudienceAnalysisSection";
import { BudgetAllocationPanel } from "./BudgetAllocationPanel";
import { AIOptimizationCenter } from "./AIOptimizationCenter";
import { AdvertisingSectionNav } from "./AdvertisingSectionNav";

type Props = AdvertisingWorkspaceView;

export function AdvertisingWorkspaceClient(props: Props) {
  const { accountability: a } = props;
  const visitRecorded = useRef(false);

  useEffect(() => {
    if (visitRecorded.current) return;
    visitRecorded.current = true;
    void recordAdvertisingVisitSnapshot({
      healthScore: props.overview.healthScore,
      profit30d: props.campaigns.reduce((sum, campaign) => sum + campaign.profit, 0),
      criticalCampaignCount: props.campaigns.filter((campaign) => campaign.healthTier === "critical").length,
      opportunityCount: props.optimizationPackages.length,
      blendedRoas: props.overview.blendedRoas,
    });
  }, []);

  return (
    <div className="adv-workspace">
      <AdvertisingSectionNav />

      <section id="account" className="adv-section">
        <AccountWideSummaryCard
          summary={props.accountSummary}
          planUsage={props.planUsage}
          scopeNotice={props.overview.analysisScopeNotice}
        />
      </section>

      <section id="priority" className="adv-section">
        <DailyPriorityCard priority={a.dailyPriority} />
      </section>

      {!a.sinceLastVisit.isFirstVisit && (
        <section id="briefing" className="adv-section">
          <SinceLastVisitBriefing briefing={a.sinceLastVisit} />
        </section>
      )}

      <section id="overview" className="adv-section adv-overview-row">
        <AIAdvertisingManagerSummary summary={props.aiManager} />
        <TrustEnginePanelView trust={a.trustEngine} />
      </section>

      <section id="accountability" className="adv-section">
        <AiAccountabilitySection items={a.accountabilityItems} />
      </section>

      <section id="learning" className="adv-section adv-learning-row">
        <LearningPersonalizationPanel insight={a.learningInsight} />
        <CrossModuleIntelligencePanel alerts={a.crossModuleAlerts} />
      </section>

      <section id="predictions" className="adv-section">
        <PredictionTrackRecordPanel record={a.predictionTrackRecord} />
      </section>

      <section id="optimization" className="adv-section">
        <AIOptimizationCenter packages={props.optimizationPackages} />
      </section>

      <section id="health" className="adv-section">
        <AdvertisingHealthExplainPanel
          overview={props.overview}
          explanations={props.healthExplanations}
        />
      </section>

      <section id="focus" className="adv-section">
        <CampaignSpotlightSection winners={props.topWinners} losers={props.topLosers} />
      </section>

      <section id="platforms" className="adv-section">
        <PlatformSummaryGrid platforms={props.platforms} />
      </section>

      <section id="campaigns" className="adv-section">
        <div className="card adv-detail-intro">
          <h2 style={{ marginTop: 0 }}>All campaigns</h2>
          <p className="muted" style={{ margin: 0, fontSize: "0.875rem" }}>
            Detailed performance data — use the spotlight cards above for where to focus first.
          </p>
        </div>
        <CampaignWorkspaceTable
          campaigns={props.campaigns}
          timelines={props.timelines}
          planUsage={props.planUsage}
        />
      </section>

      <section id="ad-sets" className="adv-section">
        <AdSetAnalysisTable adSets={props.adSets} />
      </section>

      <section id="ads" className="adv-section">
        <IndividualAdsTable ads={props.ads} />
      </section>

      <section id="creatives" className="adv-section">
        <CreativeIntelligenceSection creatives={props.creatives} />
      </section>

      <section id="audiences" className="adv-section">
        <AudienceAnalysisSection audiences={props.audiences} />
      </section>

      <section id="budget" className="adv-section">
        <BudgetAllocationPanel allocation={props.budgetAllocation} />
      </section>
    </div>
  );
}
