"use client";

import { MetricPills } from "@/components/MetricPills";
import { RecommendationLifecycleActions } from "@/components/RecommendationLifecycleActions";
import { RecommendationLifecycleStepper } from "@/components/RecommendationLifecycleStepper";
import { SeverityBadge } from "@/components/SeverityBadge";
import { ExplainPanel } from "@/components/ask-ai/ExplainPanel";
import { RecommendationCard } from "@/components/RecommendationCard";
import type {
  ApprovalEnrichedRecommendation,
  PresentedApprovalGroup,
} from "@/lib/approvals/presenter";
import type { RecommendationExplanation } from "@/lib/ai/types";
import { resolveRecommendationStatus } from "@/lib/recommendations/lifecycle";
import type { RecommendationStatus } from "@/lib/types";
import { useOptimistic, useState } from "react";

const CATEGORY_LABELS: Record<PresentedApprovalGroup["category"], string> = {
  low_inventory: "Low inventory",
  slow_selling: "Slow selling",
  bundle_opportunity: "Bundle opportunity",
  homepage_merchandising: "Homepage merchandising",
  promotion_opportunity: "Promotion opportunity",
  campaign_review: "Campaign review",
};

function GroupedMemberLifecycle({
  member,
  status,
  onExplain,
  explainLoading,
}: {
  member: ApprovalEnrichedRecommendation;
  status: RecommendationStatus;
  onExplain: () => void;
  explainLoading: boolean;
}) {
  const [optimisticStatus, setOptimisticStatus] = useOptimistic(status);

  return (
    <>
      <RecommendationLifecycleStepper recommendation={member} approvalStatus={optimisticStatus} />
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 8,
          flexWrap: "wrap",
          marginTop: 12,
        }}
      >
        <strong style={{ fontSize: "0.95rem" }}>
          {member.title.replace(/^[^:]+:\s*/, "")}
        </strong>
        <SeverityBadge severity={member.severity} />
      </div>
      <p className="muted" style={{ margin: "8px 0", fontSize: "0.875rem" }}>
        {member.expectedImpact}
      </p>
      <RecommendationLifecycleActions
        recommendation={member}
        approvalStatus={optimisticStatus}
        snoozedUntil={member.approval.snoozedUntil}
        showExplain
        onExplain={onExplain}
        explainLoading={explainLoading}
        onStatusChange={setOptimisticStatus}
      />
    </>
  );
}

export function GroupedRecommendationCard({ group }: { group: PresentedApprovalGroup }) {
  const [expanded, setExpanded] = useState(false);
  const [explainId, setExplainId] = useState<string | null>(null);
  const [explanation, setExplanation] = useState<RecommendationExplanation | null>(null);
  const [explainLoading, setExplainLoading] = useState(false);

  const primary = group.members[0];

  async function handleExplain(recommendationId: string) {
    setExplainLoading(true);
    setExplainId(recommendationId);
    try {
      const res = await fetch("/api/ask-ai/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recommendationId }),
      });
      if (res.ok) {
        const data = (await res.json()) as { explanation: RecommendationExplanation };
        setExplanation(data.explanation);
      }
    } finally {
      setExplainLoading(false);
    }
  }

  if (!group.isGroup) {
    return (
      <RecommendationCard
        recommendation={primary}
        approvalStatus={primary.approval.status}
        snoozedUntil={primary.approval.snoozedUntil}
        showActions
        showExplain
      />
    );
  }

  const combinedMetrics = [
    { label: "Items", value: String(group.members.length) },
    {
      label: "Est. net profit",
      value: group.netProfitImpact > 0 ? `+$${group.netProfitImpact.toLocaleString()}/mo net profit` : "—",
    },
    { label: "Confidence", value: `${Math.round(group.confidenceScore * 100)}%` },
  ];

  return (
    <article className="card grouped-approval-card">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <span className="category-tag">{CATEGORY_LABELS[group.category]}</span>
          <h4 style={{ margin: "6px 0 0" }}>{group.title}</h4>
        </div>
        <SeverityBadge severity={group.severity} />
      </div>

      <p className="muted" style={{ marginTop: 12, lineHeight: 1.5 }}>
        <strong>Why:</strong> {group.reason}
      </p>
      <p className="muted" style={{ marginTop: 8 }}>
        <strong>Expected impact:</strong> {group.expectedImpact}
      </p>
      <MetricPills metrics={combinedMetrics} />

      <div className="actions-row" style={{ marginTop: 12 }}>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "Hide details" : `Show ${group.members.length} affected items`}
        </button>
      </div>

      {expanded && (
        <div className="grouped-members stack" style={{ marginTop: 16 }}>
          {group.members.map((member) => {
            const status = resolveRecommendationStatus(member, member.approval.status);
            return (
              <div key={member.id} className="grouped-member card">
                <GroupedMemberLifecycle
                  member={member}
                  status={status}
                  onExplain={() => handleExplain(member.id)}
                  explainLoading={explainLoading && explainId === member.id}
                />
              </div>
            );
          })}
        </div>
      )}

      {explanation && (
        <div style={{ marginTop: 16 }}>
          <ExplainPanel explanation={explanation} onClose={() => setExplanation(null)} />
        </div>
      )}
    </article>
  );
}
