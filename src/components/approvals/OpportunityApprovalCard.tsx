"use client";

import { OpportunityInsightActions } from "@/components/opportunities/OpportunityInsightActions";
import { RecommendationLifecycleActions } from "@/components/RecommendationLifecycleActions";
import { RecommendationLifecycleStepper } from "@/components/RecommendationLifecycleStepper";
import { SeverityBadge } from "@/components/SeverityBadge";
import { ExplainPanel } from "@/components/ask-ai/ExplainPanel";
import type {
  ApprovalEnrichedRecommendation,
  PresentedApprovalCard,
} from "@/lib/approvals/presenter";
import type { RecommendationExplanation } from "@/lib/ai/types";
import { resolveRecommendationStatus } from "@/lib/recommendations/lifecycle";
import { useOptimistic, useState } from "react";

const CATEGORY_LABELS: Record<PresentedApprovalCard["category"], string> = {
  low_inventory: "Inventory",
  slow_selling: "Pricing",
  bundle_opportunity: "Bundle",
  homepage_merchandising: "Merchandising",
  promotion_opportunity: "Retention",
  campaign_review: "Marketing",
};

function MemberRow({
  member,
  onExplain,
  explainLoading,
  isExplaining,
}: {
  member: ApprovalEnrichedRecommendation;
  onExplain: (id: string) => void;
  explainLoading: boolean;
  isExplaining: boolean;
}) {
  const status = resolveRecommendationStatus(member, member.approval.status);
  const [optimisticStatus, setOptimisticStatus] = useOptimistic(status);

  return (
    <div className="opportunity-member card">
      <RecommendationLifecycleStepper
        recommendation={member}
        approvalStatus={optimisticStatus}
      />
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 8,
          marginTop: 12,
          flexWrap: "wrap",
        }}
      >
        <strong style={{ fontSize: "0.95rem" }}>
          {member.title.replace(/^[^:]+:\s*/, "")}
        </strong>
        <SeverityBadge severity={member.severity} />
      </div>
      <p className="muted" style={{ margin: "8px 0", fontSize: "0.875rem", lineHeight: 1.5 }}>
        {member.reason}
      </p>
      <RecommendationLifecycleActions
        recommendation={member}
        approvalStatus={optimisticStatus}
        snoozedUntil={member.approval.snoozedUntil}
        showExplain
        onExplain={() => onExplain(member.id)}
        explainLoading={explainLoading && isExplaining}
        onStatusChange={setOptimisticStatus}
      />
    </div>
  );
}

export function OpportunityApprovalCard({ card }: { card: PresentedApprovalCard }) {
  const [expanded, setExpanded] = useState(false);
  const [explainId, setExplainId] = useState<string | null>(null);
  const [explanation, setExplanation] = useState<RecommendationExplanation | null>(null);
  const [explainLoading, setExplainLoading] = useState(false);

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

  const findingsLabel =
    card.findingsCount > 1
      ? `${card.findingsCount} findings`
      : card.isCampaignPortfolio
        ? `${card.findingsCount} need review`
        : null;

  return (
    <article className="card opportunity-approval-card">
      <div className="opportunity-impact-header">
        <div className="opportunity-impact-metric">
          <span className="muted opportunity-impact-label">Expected Net Profit Gain</span>
          <strong className="opportunity-impact-value">
            {card.netProfitImpact > 0
              ? `+$${card.netProfitImpact.toLocaleString()}`
              : "—"}
          </strong>
        </div>
        <div className="opportunity-impact-metric">
          <span className="muted opportunity-impact-label">Confidence</span>
          <strong className="opportunity-impact-value">
            {Math.round(card.confidenceScore * 100)}%
          </strong>
        </div>
        <div className="opportunity-impact-metric">
          <span className="muted opportunity-impact-label">Effort</span>
          <strong className="opportunity-impact-value">{card.implementationEffort}</strong>
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <span className="category-tag">
          {card.subtitle ?? CATEGORY_LABELS[card.category]}
        </span>
        <h4 style={{ margin: "8px 0 0", fontSize: "1.1rem" }}>{card.title}</h4>
        {findingsLabel && (
          <p className="muted" style={{ margin: "6px 0 0", fontSize: "0.85rem" }}>
            {findingsLabel}
          </p>
        )}
      </div>

      <p className="muted" style={{ marginTop: 12, lineHeight: 1.5 }}>
        {card.reason}
      </p>

      <OpportunityInsightActions
        recommendationId={card.members[0]?.id}
        showExplain={card.members.length === 1}
        onExplain={
          card.members.length === 1
            ? () => handleExplain(card.members[0].id)
            : undefined
        }
        explainLoading={explainLoading}
      />

      {card.isCampaignPortfolio && card.campaignBrief && (
        <div className="campaign-brief-stats">
          <p style={{ margin: "0 0 8px", fontWeight: 600 }}>{card.campaignBrief.platform}</p>
          <ul className="campaign-brief-list">
            <li>{card.campaignBrief.scanned} campaigns analyzed</li>
            <li>Active: {card.campaignBrief.active}</li>
            <li>Paused: {card.campaignBrief.paused}</li>
            <li>Draft: {card.campaignBrief.draft}</li>
            <li>Needs review: {card.campaignBrief.needsReview}</li>
          </ul>
        </div>
      )}

      {!card.isCampaignPortfolio && card.members.length === 1 && (
        <div style={{ marginTop: 16 }}>
          <RecommendationLifecycleActions
            recommendation={card.members[0]}
            approvalStatus={resolveRecommendationStatus(
              card.members[0],
              card.members[0].approval.status,
            )}
            snoozedUntil={card.members[0].approval.snoozedUntil}
            showExplain
            onExplain={() => handleExplain(card.members[0].id)}
            explainLoading={explainLoading}
          />
        </div>
      )}

      {(card.isCampaignPortfolio || card.findingsCount > 1 || card.members.length > 1) && (
        <div className="actions-row" style={{ marginTop: 16 }}>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded
              ? "Hide details"
              : card.isCampaignPortfolio
                ? "Expand campaigns"
                : "Expand for details"}
          </button>
        </div>
      )}

      {expanded && (
        <div className="stack" style={{ marginTop: 16 }}>
          {card.members.map((member) => (
            <MemberRow
              key={member.id}
              member={member}
              onExplain={handleExplain}
              explainLoading={explainLoading}
              isExplaining={explainId === member.id}
            />
          ))}
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
