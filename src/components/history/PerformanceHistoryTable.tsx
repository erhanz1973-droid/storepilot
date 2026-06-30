"use client";

import { PerformanceRowDetail } from "@/components/history/PerformanceRowDetail";
import { RecommendationLifecycleTimeline } from "@/components/history/RecommendationLifecycleTimeline";
import { BUSINESS_AREAS, type BusinessAreaId } from "@/lib/history/business-areas";
import type { PerformanceHistoryRow } from "@/lib/history/performance-dashboard";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState, useTransition } from "react";

const PAGE_SIZE = 25;

function fmtMoney(n: number | null): string {
  if (n == null || n === 0) return "—";
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 })}`;
}

export function PerformanceHistoryFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const updateFilter = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) params.set(key, value);
      else params.delete(key);
      startTransition(() => router.push(`/history?${params.toString()}`));
    },
    [router, searchParams],
  );

  return (
    <div className="performance-filters">
      <span className="muted performance-filters-label">Filter by business area</span>
      <div className="performance-filter-chips">
        <button
          type="button"
          className={`performance-filter-chip ${!searchParams.get("area") ? "is-active" : ""}`}
          disabled={isPending}
          onClick={() => updateFilter("area", "")}
        >
          All
        </button>
        {BUSINESS_AREAS.map((area) => (
          <button
            key={area.id}
            type="button"
            className={`performance-filter-chip ${searchParams.get("area") === area.id ? "is-active" : ""}`}
            disabled={isPending}
            onClick={() => updateFilter("area", area.id)}
          >
            {area.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function PerformanceRow({
  row,
  expanded,
  onToggle,
}: {
  row: PerformanceHistoryRow;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr className={expanded ? "is-expanded-row" : undefined}>
        <td>
          <button
            type="button"
            className="btn btn-ghost btn-sm performance-expand-btn"
            onClick={onToggle}
            aria-expanded={expanded}
            aria-label={expanded ? "Collapse" : "Expand"}
          >
            {expanded ? "−" : "+"}
          </button>
        </td>
        <td>
          <strong>{row.entry.recommendation.title}</strong>
        </td>
        <td>
          <span className="status-pill">{row.statusLabel}</span>
        </td>
        <td>{fmtMoney(row.expectedMonthlyProfit)}</td>
        <td>{fmtMoney(row.actualMonthlyProfit)}</td>
        <td>{row.forecastAccuracyPct != null ? `${row.forecastAccuracyPct}%` : "—"}</td>
        <td>{row.measurementWindowDays != null ? `${row.measurementWindowDays}d` : "—"}</td>
        <td>{row.outcomeLabel}</td>
        <td>{row.businessAreaLabel}</td>
        <td>{row.merchantDecision}</td>
      </tr>
      {expanded && (
        <tr className="performance-detail-row">
          <td colSpan={10}>
            <div className="performance-expanded-body">
              <RecommendationLifecycleTimeline activeIndex={row.lifecycleIndex} />
              <PerformanceRowDetail row={row} />
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export function PerformanceHistoryTable({ rows }: { rows: PerformanceHistoryRow[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const searchParams = useSearchParams();
  const areaFilter = searchParams.get("area") as BusinessAreaId | null;

  const filtered = useMemo(
    () => (areaFilter ? rows.filter((r) => r.businessArea === areaFilter) : rows),
    [areaFilter, rows],
  );

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = useMemo(
    () => filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE),
    [filtered, safePage],
  );

  if (filtered.length === 0) {
    return (
      <p className="empty-state">
        No recommendations match your filters. Approve actions in the Approval Center to build your
        AI performance history.
      </p>
    );
  }

  return (
    <div className="performance-table-wrap">
      <table className="performance-table">
        <thead>
          <tr>
            <th aria-label="Expand" style={{ width: 40 }} />
            <th>Recommendation</th>
            <th>Status</th>
            <th>Expected Impact</th>
            <th>Actual Impact</th>
            <th>Forecast Accuracy</th>
            <th>Window</th>
            <th>Outcome</th>
            <th>Business Area</th>
            <th>Merchant Decision</th>
          </tr>
        </thead>
        <tbody>
          {pageRows.map((row) => (
            <PerformanceRow
              key={row.entry.id}
              row={row}
              expanded={expandedId === row.entry.id}
              onToggle={() =>
                setExpandedId((id) => (id === row.entry.id ? null : row.entry.id))
              }
            />
          ))}
        </tbody>
      </table>
      {filtered.length > PAGE_SIZE && (
        <div className="performance-table-pagination">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={safePage === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            Previous
          </button>
          <span className="muted">
            Page {safePage + 1} of {pageCount} · {filtered.length} recommendations
          </span>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={safePage >= pageCount - 1}
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
