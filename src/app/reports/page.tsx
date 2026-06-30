import { AnalyticsPageShell } from "@/components/analytics/AnalyticsPageShell";
import { ReportsExecutiveSummary } from "@/components/reports/ReportsExecutiveSummary";
import { WeeklyScorecard } from "@/components/reports/WeeklyScorecard";
import { WinsProblemsSection } from "@/components/reports/WinsProblemsSection";
import { AiOutcomesSection } from "@/components/reports/AiOutcomesSection";
import { FinancialImpactCard } from "@/components/reports/FinancialImpactCard";
import { LearningTimeline } from "@/components/reports/LearningTimeline";
import { AiLearningProgress } from "@/components/reports/AiLearningProgress";
import { NextWeekPlan } from "@/components/reports/NextWeekPlan";
import { ReportExportBar } from "@/components/reports/ReportExportBar";
import { buildReportsPageData } from "@/lib/services/reports";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const report = await buildReportsPageData();

  return (
    <AnalyticsPageShell
      title="Weekly Report"
      description="Your AI business consultant — what happened, why, what improved, and what to do next."
      context="executive"
      syncedAt={report.generatedAt}
      showDateRange={false}
    >
      <div className="reports-page" id="reports-print-root">
        <ReportsExecutiveSummary report={report} />
        <WeeklyScorecard items={report.scorecard} />
        <WinsProblemsSection wins={report.wins} problems={report.problems} />
        <AiOutcomesSection stats={report.aiOutcomes} />
        <FinancialImpactCard impact={report.financialImpact} />
        <div className="reports-two-col">
          <LearningTimeline events={report.timeline} />
          <AiLearningProgress learning={report.learning} />
        </div>
        <NextWeekPlan priorities={report.nextWeekPlan} />
        <ReportExportBar report={report} />
      </div>
    </AnalyticsPageShell>
  );
}
