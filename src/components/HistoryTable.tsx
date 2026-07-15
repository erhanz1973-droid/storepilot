"use client";

import type {
  RecommendationCategory,
  RecommendationHistoryEntry,
  RecommendationSeverity,
  RecommendationStatus,
} from "@/lib/types";
import { CampaignMetaDetails } from "@/components/campaigns/CampaignMetaDetails";
import { lifecycleStatusLabel } from "@/lib/recommendations/lifecycle";
import { SeverityBadge } from "@/components/SeverityBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";

const STATUS_OPTIONS: RecommendationStatus[] = [
  "pending",
  "approved",
  "implemented",
  "completed",
  "measured",
  "ignored",
  "snoozed",
];

const PRIORITY_OPTIONS: RecommendationSeverity[] = ["critical", "high", "medium", "low"];

const CATEGORY_OPTIONS: { value: RecommendationCategory; label: string }[] = [
  { value: "low_inventory", label: "Low inventory" },
  { value: "slow_selling", label: "Slow selling" },
  { value: "bundle_opportunity", label: "Bundle" },
  { value: "homepage_merchandising", label: "Homepage" },
  { value: "promotion_opportunity", label: "Promotion" },
  { value: "campaign_review", label: "Campaign" },
];

export function HistoryFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const updateFilter = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) params.set(key, value);
      else params.delete(key);
      startTransition(() => {
        router.push(`/history?${params.toString()}`);
      });
    },
    [router, searchParams],
  );

  return (
    <div className="history-filters">
      <label>
        <span className="muted">Status</span>
        <select
          value={searchParams.get("status") ?? ""}
          onChange={(e) => updateFilter("status", e.target.value)}
          disabled={isPending}
        >
          <option value="">All</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span className="muted">Priority</span>
        <select
          value={searchParams.get("priority") ?? ""}
          onChange={(e) => updateFilter("priority", e.target.value)}
          disabled={isPending}
        >
          <option value="">All</option>
          {PRIORITY_OPTIONS.map((p) => (
            <option key={p} value={p}>
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span className="muted">Type</span>
        <select
          value={searchParams.get("category") ?? ""}
          onChange={(e) => updateFilter("category", e.target.value)}
          disabled={isPending}
        >
          <option value="">All</option>
          {CATEGORY_OPTIONS.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

function formatDate(value?: string) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

export function HistoryTable({ entries }: { entries: RecommendationHistoryEntry[] }) {
  if (entries.length === 0) {
    return (
      <div className="card">
        <EmptyState
          title="No recommendations match your filters"
          reason="History fills in after StorePilot generates and measures recommendations for this store."
          nextStep="Connect Shopify (and ads if available), then open first-run analysis or Approvals to generate your first decisions."
          cta={{ href: "/first-run", label: "Run first analysis" }}
        />
      </div>
    );
  }

  return (
    <div className="history-table-wrap">
      <table className="history-table">
        <thead>
          <tr>
            <th>Recommendation</th>
            <th>Campaign</th>
            <th>Decision</th>
            <th>Priority</th>
            <th>Expected Impact</th>
            <th>Confidence</th>
            <th>Created</th>
            <th>Approved</th>
            <th>Completed</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.id}>
              <td>
                <strong>{entry.recommendation.title}</strong>
                <span className="category-tag" style={{ display: "block", marginTop: 4 }}>
                  {entry.recommendation.category.replace(/_/g, " ")}
                </span>
              </td>
              <td>
                <CampaignMetaDetails details={entry.campaignDetails} compact />
              </td>
              <td>
                <span className="status-pill">{lifecycleStatusLabel(entry.status, "tr")}</span>
              </td>
              <td>
                <SeverityBadge severity={entry.recommendation.severity} />
              </td>
              <td className="muted">{entry.expectedImpact}</td>
              <td>{Math.round(entry.confidenceScore * 100)}%</td>
              <td className="muted">{formatDate(entry.createdAt)}</td>
              <td className="muted">{formatDate(entry.approvedAt)}</td>
              <td className="muted">{formatDate(entry.completedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
