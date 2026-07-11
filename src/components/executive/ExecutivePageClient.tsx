"use client";

import { useEffect, useRef, useState } from "react";
import type { ExecutivePageData } from "@/lib/services/analytics";
import { recordExecutiveVisitSnapshot } from "@/actions/visit-tracking";
import { LazyWhenVisible } from "@/components/performance/LazyWhenVisible";
import { ExecutiveCeoOperatingPanel } from "@/components/executive/ceo-os/ExecutiveCeoOperatingPanel";
import { ExecutiveHeroSection } from "@/components/executive/advisor/ExecutiveHeroSection";
import { ExecutiveAiGreetingCard } from "@/components/executive/advisor/ExecutiveAiGreetingCard";
import { ExecutiveDemoBanner } from "@/components/executive/advisor/ExecutiveDemoBanner";
import { ExecutiveIntegrationBanner } from "@/components/executive/advisor/ExecutiveIntegrationBanner";
import { ExecutiveMoneyLeaksCard } from "@/components/executive/advisor/ExecutiveMoneyLeaksCard";
import { ExecutiveCashFlowCard } from "@/components/executive/advisor/ExecutiveCashFlowCard";
import { ExecutiveHealthBreakdownCard } from "@/components/executive/advisor/ExecutiveHealthBreakdownCard";
import { ExecutivePriorityActionCard } from "@/components/executive/advisor/ExecutivePriorityActionCard";
import { ExecutiveDailyChangesCard } from "@/components/executive/advisor/ExecutiveDailyChangesCard";
import { ExecutiveRecommendationsTable } from "@/components/executive/advisor/ExecutiveRecommendationsTable";
import { ExecutiveAutopilotSection } from "@/components/executive/advisor/ExecutiveAutopilotSection";
import { ExecutiveAiTimeline } from "@/components/executive/advisor/ExecutiveAiTimeline";
import { ExecutiveAiLearningCard } from "@/components/executive/advisor/ExecutiveAiLearningCard";
import { ExecutiveMemoryCard } from "@/components/executive/advisor/ExecutiveMemoryCard";
import { ExecutiveRecoveryProgressCard } from "@/components/executive/advisor/ExecutiveRecoveryProgressCard";
import { ExecutiveBeforeAfterCard } from "@/components/executive/advisor/ExecutiveBeforeAfterCard";
import { ExecutiveConfidenceEvolutionCard } from "@/components/executive/advisor/ExecutiveConfidenceEvolutionCard";
import { ExecutiveDailyDigestCard } from "@/components/executive/advisor/ExecutiveDailyDigestCard";
import { ExecutiveAdoptionScoreCard } from "@/components/executive/advisor/ExecutiveAdoptionScoreCard";
import { ExecutiveKpiRow } from "@/components/executive/advisor/ExecutiveKpiRow";
import { ExecutiveFinancialContextCard } from "@/components/executive/advisor/ExecutiveFinancialContextCard";
import { PlanScaleBanner } from "@/components/billing/PlanScaleBanner";
import type { CampaignEntitlements } from "@/lib/billing/types";

function FullAnalysis({ view }: { view: ExecutivePageData }) {
  const { aiBehavior: ai } = view;

  return (
    <>
      {view.validation.issues.length > 0 && (
        <div className="exec-advisor-validation-banner" role="status">
          {view.validation.issues.map((issue) => (
            <p key={issue.code} className={`exec-advisor-validation-${issue.severity}`}>
              {issue.message}
            </p>
          ))}
        </div>
      )}
      <ExecutiveIntegrationBanner readiness={view.integrationReadiness} />
      <ExecutiveKpiRow kpis={view.executiveKpis} />
      <ExecutiveDailyDigestCard digest={ai.dailyDigest} />
      <ExecutiveAiGreetingCard brief={view.ceoBriefFull} hidePriority={Boolean(ai.dailyDigest?.showToday)} />
      <ExecutiveRecoveryProgressCard progress={ai.recoveryProgress} />
      <ExecutiveFinancialContextCard context={view.financialContext} />

      <LazyWhenVisible fallback={<div className="card skeleton-card" style={{ minHeight: 280 }} aria-busy="true" />}>
        <ExecutiveHeroSection
          forecast={view.forecast}
          recoveryBreakdown={view.recoveryBreakdown}
          profitCalculation={view.profitCalculation}
          profitDisplay={view.profitDisplay}
        />
      </LazyWhenVisible>

      <LazyWhenVisible fallback={<div className="card skeleton-card" style={{ minHeight: 200 }} aria-busy="true" />}>
        <ExecutiveBeforeAfterCard impact={ai.beforeAfter} />
        <ExecutiveDailyChangesCard changes={view.dailyChanges} />
        <ExecutiveMemoryCard items={ai.memory} />
      </LazyWhenVisible>

      <div className="exec-advisor-two-col">
        <ExecutivePriorityActionCard
          action={view.priorityAction}
          recommendationHistory={ai.recommendationHistories[0] ?? null}
        />
        <ExecutiveMoneyLeaksCard leaks={view.moneyLeaks} />
      </div>

      <LazyWhenVisible fallback={<div className="card skeleton-card" style={{ minHeight: 240 }} aria-busy="true" />}>
        <div className="exec-advisor-two-col">
          <ExecutiveCashFlowCard
            cashFlow={view.cashFlow}
            profitCalculation={view.profitCalculation}
          />
          <ExecutiveHealthBreakdownCard health={view.healthBreakdown} />
        </div>

        <div className="exec-advisor-two-col">
          <ExecutiveConfidenceEvolutionCard evolution={ai.confidenceEvolution} />
          <ExecutiveAdoptionScoreCard score={ai.adoptionScore} />
        </div>

        <ExecutiveAiLearningCard
          learning={view.aiLearning}
          recentLearnings={ai.recentLearnings}
        />
        <ExecutiveAutopilotSection autopilot={view.autopilot} />
        <ExecutiveRecommendationsTable
          rows={view.recommendationRows}
          recommendationHistories={ai.recommendationHistories}
        />
        <ExecutiveAiTimeline entries={view.aiTimeline} />
      </LazyWhenVisible>
    </>
  );
}

export function ExecutivePageClient({
  view,
  isDemo = false,
  planUsage,
}: {
  view: ExecutivePageData;
  isDemo?: boolean;
  planUsage?: CampaignEntitlements;
}) {
  const [executiveMode, setExecutiveMode] = useState(true);
  const [showFull, setShowFull] = useState(false);
  const visitRecorded = useRef(false);

  useEffect(() => {
    if (visitRecorded.current) return;
    visitRecorded.current = true;
    void recordExecutiveVisitSnapshot({
      estimatedProfit: view.executiveMode.estimatedProfit,
      businessHealthScore: view.executiveFocus.businessHealth.score,
      recoveryPotential: view.executiveFocus.recoveryPotentialMonthly,
      openDecisionCount: view.autopilot.pendingCount,
      threatLabel: view.executiveMode.biggestThreat.label,
    });
  }, []);

  return (
    <div className="exec-dashboard exec-advisor-dashboard">
      {isDemo && <ExecutiveDemoBanner />}
      {!isDemo && <ExecutiveIntegrationBanner readiness={view.integrationReadiness} />}

      <div className="exec-advisor-mode-toggle">
        <button
          type="button"
          className={`btn btn-ghost ${executiveMode ? "active" : ""}`}
          onClick={() => {
            setExecutiveMode(true);
            setShowFull(false);
          }}
        >
          Executive Mode
        </button>
        <button
          type="button"
          className={`btn btn-ghost ${!executiveMode ? "active" : ""}`}
          onClick={() => setExecutiveMode(false)}
        >
          Full Dashboard
        </button>
      </div>

      {executiveMode ? (
        <>
          {!showFull && (
            <>
              <ExecutiveCeoOperatingPanel view={view} onShowFull={() => setShowFull(true)} />
              {planUsage && !planUsage.isUnlimited && (
                <PlanScaleBanner
                  entitlements={planUsage}
                  unlockedCampaignName={planUsage.unlockedCampaignName}
                />
              )}
            </>
          )}
          {showFull && (
            <>
              <FullAnalysis view={view} />
              <button
                type="button"
                className="btn btn-ghost exec-advisor-collapse-btn"
                onClick={() => setShowFull(false)}
              >
                ← Back to Executive Mode
              </button>
            </>
          )}
        </>
      ) : (
        <FullAnalysis view={view} />
      )}
    </div>
  );
}
