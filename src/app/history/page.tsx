import { HistoryPerformanceDashboard } from "@/components/history/HistoryPerformanceDashboard";
import { LoadingState } from "@/components/ui/LoadingState";
import { listActionExecutions } from "@/lib/db/action-executions";
import { listOutcomeRecords } from "@/lib/db/outcome-records";
import { buildPerformanceDashboard } from "@/lib/history/performance-dashboard";
import { getHistory } from "@/lib/services/dashboard";
import { resolveActiveStoreId } from "@/lib/store/context";
import type { RecommendationCategory, RecommendationSeverity, RecommendationStatus } from "@/lib/types";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  status?: string;
  priority?: string;
  category?: string;
}>;

async function HistoryDashboardContent({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const storeId = await resolveActiveStoreId();

  const [entries, outcomes, executionLogs] = await Promise.all([
    getHistory({
      status: params.status as RecommendationStatus | undefined,
      priority: params.priority as RecommendationSeverity | undefined,
      category: params.category as RecommendationCategory | undefined,
    }),
    listOutcomeRecords(storeId, 200),
    listActionExecutions(storeId, 20),
  ]);

  const view = buildPerformanceDashboard(entries, outcomes);

  return <HistoryPerformanceDashboard view={view} executionLogs={executionLogs} />;
}

export default function HistoryPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <>
      <div className="page-header">
        <h2>AI Performance</h2>
        <p>
          See whether StorePilot&apos;s recommendations create measurable business value — accuracy,
          outcomes, and continuous learning from every decision.
        </p>
      </div>

      <Suspense fallback={<LoadingState label="Loading AI performance data…" />}>
        <HistoryDashboardContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}
