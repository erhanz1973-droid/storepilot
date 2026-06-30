import { AiPerformanceSummaryCard } from "@/components/history/AiPerformanceSummaryCard";
import { OutcomeMeasurementPanel } from "@/components/history/OutcomeMeasurementPanel";
import {
  PerformanceHistoryFilters,
  PerformanceHistoryTable,
} from "@/components/history/PerformanceHistoryTable";
import { ExecutionHistoryList } from "@/components/execution/ExecutionHistoryList";
import { LoadingState } from "@/components/ui/LoadingState";
import type { PerformanceDashboardView } from "@/lib/history/performance-dashboard";
import type { ActionExecutionLog } from "@/lib/execution/types";
import Link from "next/link";
import { Suspense } from "react";

export function HistoryPerformanceDashboard({
  view,
  executionLogs,
}: {
  view: PerformanceDashboardView;
  executionLogs: ActionExecutionLog[];
}) {
  return (
    <>
      <AiPerformanceSummaryCard summary={view.summary} />
      <OutcomeMeasurementPanel hasMeasuredOutcomes={view.hasMeasuredOutcomes} />

      <div className="card" style={{ marginBottom: 16 }}>
        <Suspense fallback={<LoadingState label="Loading filters…" />}>
          <PerformanceHistoryFilters />
        </Suspense>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Recommendation Performance</h3>
        <p className="muted" style={{ margin: "0 0 16px", fontSize: "0.88rem" }}>
          Expand any row to see lifecycle, expected vs actual results, and what StorePilot learned.
        </p>
        <Suspense fallback={<LoadingState label="Loading recommendations…" />}>
          <PerformanceHistoryTable rows={view.rows} />
        </Suspense>
      </div>

      {executionLogs.length > 0 && (
        <details className="card history-execution-details" style={{ marginTop: 16 }}>
          <summary>Execution logs ({executionLogs.length})</summary>
          <ExecutionHistoryList logs={executionLogs} />
        </details>
      )}

      <section className="card history-vision-card" style={{ marginTop: 16 }}>
        <p className="ai-perf-eyebrow">Long-term vision</p>
        <p className="muted" style={{ margin: 0, lineHeight: 1.55, fontSize: "0.9rem" }}>
          {view.visionStatement}
        </p>
        <p className="muted" style={{ margin: "10px 0 0", fontSize: "0.85rem" }}>
          <Link href="/approvals">Approval Center</Link> · <Link href="/autopilot">Autopilot</Link>
        </p>
      </section>
    </>
  );
}
