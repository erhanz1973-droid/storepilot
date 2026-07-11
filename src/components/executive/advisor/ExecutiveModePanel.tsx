"use client";

import type { ExecutivePageData } from "@/lib/services/analytics";
import { DailyAiPlaybookSection } from "@/components/executive/DailyAiPlaybookSection";
import { ExecutiveFocusSummaryCard } from "@/components/executive/ExecutiveFocusSummaryCard";
import { ExecutiveRecoveryBreakdown } from "@/components/executive/advisor/ExecutiveRecoveryBreakdown";
import { ExecutivePriorityActionCard } from "@/components/executive/advisor/ExecutivePriorityActionCard";
import { ExecutiveCalculationDrawer } from "@/components/executive/advisor/ExecutiveCalculationDrawer";
import { ExecutiveAiGreetingCard } from "@/components/executive/advisor/ExecutiveAiGreetingCard";
import { ExecutiveRecoveryProgressCard } from "@/components/executive/advisor/ExecutiveRecoveryProgressCard";
import { ExecutiveMemoryCard } from "@/components/executive/advisor/ExecutiveMemoryCard";
import { ExecutiveDailyDigestCard } from "@/components/executive/advisor/ExecutiveDailyDigestCard";
import { ExecutiveKpiRow } from "@/components/executive/advisor/ExecutiveKpiRow";
import { ExecutiveFinancialContextCard } from "@/components/executive/advisor/ExecutiveFinancialContextCard";
import { EXEC_METRIC_ICONS, MetricLabel } from "@/components/executive/advisor/executive-metric-icons";

function fmt(n: number) {
  const sign = n >= 0 ? "" : "-";
  return `${sign}$${Math.abs(n).toLocaleString()}`;
}

type Props = {
  view: ExecutivePageData;
  onShowFull: () => void;
};

export function ExecutiveModePanel({ view, onShowFull }: Props) {
  const { executiveMode: mode, recoveryBreakdown, priorityAction, profitCalculation, profitDisplay } =
    view;
  const profitUnavailable = profitDisplay.status === "unavailable";
  const profitNegative = !profitUnavailable && mode.estimatedProfit < 0;
  const digestVisible = Boolean(view.aiBehavior.dailyDigest?.showToday);
  const priorityTitle = priorityAction?.title?.toLowerCase() ?? "";
  const memoryItems = view.aiBehavior.memory
    .filter((item) => !priorityTitle || !item.title.toLowerCase().includes(priorityTitle.slice(0, 12)))
    .slice(0, 2);

  return (
    <>
      <ExecutiveFocusSummaryCard focus={view.executiveFocus} />
      <DailyAiPlaybookSection playbook={view.dailyPlaybook} showStoryFlow />

      <ExecutiveKpiRow kpis={view.executiveKpis} />
      <section className="exec-advisor-mode card">
        <ExecutiveDailyDigestCard digest={view.aiBehavior.dailyDigest} />
        <ExecutiveAiGreetingCard brief={view.ceoBrief} hidePriority={digestVisible} />
        <ExecutiveRecoveryProgressCard progress={view.aiBehavior.recoveryProgress} />

        <div className="exec-advisor-mode-header">
          <div>
            <p className="exec-advisor-mode-badge">Executive Mode</p>
            <h2 className="exec-advisor-mode-title">Your business in 30 seconds</h2>
          </div>
          <button type="button" className="btn btn-ghost exec-advisor-mode-expand" onClick={onShowFull}>
            Full analysis →
          </button>
        </div>

        <ExecutiveFinancialContextCard context={view.financialContext} />

        <div className="exec-advisor-mode-grid exec-advisor-hero-hierarchy">
          <div className="exec-advisor-mode-item tier-primary">
            <MetricLabel icon={EXEC_METRIC_ICONS.profit} className="exec-advisor-mode-label">
              Estimated Profit
            </MetricLabel>
            {profitUnavailable ? (
              <>
                <strong className="exec-advisor-mode-value exec-mode-value-primary exec-kpi-warning">
                  Unavailable
                </strong>
                <p className="muted exec-advisor-profit-unavailable-msg">
                  {profitDisplay.unavailableMessage}
                </p>
              </>
            ) : (
              <>
                <strong
                  className={`exec-advisor-mode-value exec-mode-value-primary ${profitNegative ? "negative" : "positive"}`}
                >
                  {fmt(mode.estimatedProfit)}/mo
                </strong>
                <ExecutiveCalculationDrawer
                  trace={profitCalculation}
                  displayValue={mode.estimatedProfit}
                  compact
                />
              </>
            )}
          </div>
          <div className="exec-advisor-mode-item tier-secondary">
            <MetricLabel icon={EXEC_METRIC_ICONS.recovery} className="exec-advisor-mode-label">
              Recovery Potential
            </MetricLabel>
            <ExecutiveRecoveryBreakdown breakdown={recoveryBreakdown} compact />
          </div>
          <div className="exec-advisor-mode-item tier-tertiary threat">
            <MetricLabel icon={EXEC_METRIC_ICONS.threat} className="exec-advisor-mode-label">
              Biggest Threat
            </MetricLabel>
            <strong className="exec-advisor-mode-value">{mode.biggestThreat.label}</strong>
            {mode.biggestThreat.amountMonthly > 0 && (
              <span className="exec-advisor-mode-sub negative">
                -{fmt(mode.biggestThreat.amountMonthly)}/mo
              </span>
            )}
          </div>
          <div className="exec-advisor-mode-item tier-tertiary opportunity">
            <MetricLabel icon={EXEC_METRIC_ICONS.opportunity} className="exec-advisor-mode-label">
              Best Opportunity
            </MetricLabel>
            <strong className="exec-advisor-mode-value">{mode.bestOpportunity.label}</strong>
            {mode.bestOpportunity.amountMonthly > 0 && (
              <span className="exec-advisor-mode-sub positive">
                +{fmt(mode.bestOpportunity.amountMonthly)}/mo
              </span>
            )}
          </div>
        </div>

        {priorityAction && (
          <div className="exec-advisor-mode-action">
            <ExecutivePriorityActionCard
              action={priorityAction}
              compact
              recommendationHistory={view.aiBehavior.recommendationHistories[0] ?? null}
            />
          </div>
        )}

        {memoryItems.length > 0 && <ExecutiveMemoryCard items={memoryItems} />}
      </section>
    </>
  );
}
