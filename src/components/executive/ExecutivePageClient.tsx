"use client";

import { useState } from "react";
import type { ExecutiveAdvisorView } from "@/lib/analytics/executive-advisor";
import { ExecutiveModePanel } from "@/components/executive/advisor/ExecutiveModePanel";
import { ExecutiveHeroSection } from "@/components/executive/advisor/ExecutiveHeroSection";
import { ExecutiveAiGreetingCard } from "@/components/executive/advisor/ExecutiveAiGreetingCard";
import { ExecutiveDemoBanner } from "@/components/executive/advisor/ExecutiveDemoBanner";
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

function FullAnalysis({ view }: { view: ExecutiveAdvisorView }) {
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
      <ExecutiveDailyDigestCard digest={ai.dailyDigest} />
      <ExecutiveAiGreetingCard brief={view.ceoBriefFull} hidePriority={Boolean(ai.dailyDigest?.showToday)} />
      <ExecutiveRecoveryProgressCard progress={ai.recoveryProgress} />
      <ExecutiveHeroSection
        forecast={view.forecast}
        recoveryBreakdown={view.recoveryBreakdown}
        profitCalculation={view.profitCalculation}
      />
      <ExecutiveBeforeAfterCard impact={ai.beforeAfter} />
      <ExecutiveDailyChangesCard changes={view.dailyChanges} />

      <ExecutiveMemoryCard items={ai.memory} />

      <div className="exec-advisor-two-col">
        <ExecutivePriorityActionCard
          action={view.priorityAction}
          recommendationHistory={ai.recommendationHistories[0] ?? null}
        />
        <ExecutiveMoneyLeaksCard leaks={view.moneyLeaks} />
      </div>

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
    </>
  );
}

export function ExecutivePageClient({
  view,
  isDemo = false,
}: {
  view: ExecutiveAdvisorView;
  isDemo?: boolean;
}) {
  const [executiveMode, setExecutiveMode] = useState(true);
  const [showFull, setShowFull] = useState(false);

  return (
    <div className="exec-dashboard exec-advisor-dashboard">
      {isDemo && <ExecutiveDemoBanner />}

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
            <ExecutiveModePanel view={view} onShowFull={() => setShowFull(true)} />
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
