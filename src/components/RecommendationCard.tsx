"use client";

import { RecommendationFeedback } from "@/components/RecommendationFeedback";
import { MetricPills } from "@/components/MetricPills";
import { RevenueImpactPanel } from "@/components/impact/RevenueImpactPanel";
import { OpportunityInsightActions } from "@/components/opportunities/OpportunityInsightActions";
import { RecommendationLifecycleActions } from "@/components/RecommendationLifecycleActions";
import { RecommendationLifecycleStepper } from "@/components/RecommendationLifecycleStepper";
import { SeverityBadge } from "@/components/SeverityBadge";
import { ExplainPanel } from "@/components/ask-ai/ExplainPanel";
import {
  lifecycleStatusLabel,
  resolveRecommendationStatus,
} from "@/lib/recommendations/lifecycle";
import type { Recommendation, RecommendationStatus } from "@/lib/types";
import type { RecommendationExplanation } from "@/lib/ai/types";
import { estimateFromRecommendation } from "@/lib/impact/estimate";
import { useOptimistic, useState } from "react";

type Props = {
  recommendation: Recommendation;
  approvalStatus?: RecommendationStatus;
  snoozedUntil?: string;
  showActions?: boolean;
  showExplain?: boolean;
  compact?: boolean;
};

const CATEGORY_LABELS: Record<Recommendation["category"], string> = {
  low_inventory: "Low inventory",
  slow_selling: "Slow selling",
  bundle_opportunity: "Bundle opportunity",
  homepage_merchandising: "Homepage merchandising",
  promotion_opportunity: "Promotion opportunity",
  campaign_review: "Campaign review",
};

export function RecommendationCard({
  recommendation,
  approvalStatus,
  snoozedUntil,
  showActions = false,
  showExplain = false,
  compact = false,
}: Props) {
  const [explanation, setExplanation] = useState<RecommendationExplanation | null>(null);
  const [explainLoading, setExplainLoading] = useState(false);

  const resolved = resolveRecommendationStatus(recommendation, approvalStatus);
  const [optimisticStatus, setOptimisticStatus] = useOptimistic(resolved);
  const impact = estimateFromRecommendation(recommendation);

  async function handleExplain() {
    setExplainLoading(true);
    try {
      const res = await fetch("/api/ask-ai/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recommendationId: recommendation.id }),
      });
      if (res.ok) {
        const data = (await res.json()) as { explanation: RecommendationExplanation };
        setExplanation(data.explanation);
      }
    } finally {
      setExplainLoading(false);
    }
  }

  return (
    <article className="card recommendation-lifecycle-card">
      <RecommendationLifecycleStepper
        recommendation={recommendation}
        approvalStatus={optimisticStatus}
      />

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          marginTop: 16,
        }}
      >
        <div>
          <span className="category-tag">{CATEGORY_LABELS[recommendation.category]}</span>
          <h4 style={{ margin: "6px 0 0", fontSize: compact ? "0.95rem" : "1.05rem" }}>
            {recommendation.title}
          </h4>
        </div>
        <div style={{ textAlign: "right" }}>
          <SeverityBadge severity={recommendation.severity} />
          <p className="muted" style={{ margin: "6px 0 0", fontSize: "0.8rem" }}>
            {lifecycleStatusLabel(optimisticStatus)}
          </p>
        </div>
      </div>

      {!compact && optimisticStatus !== "measured" && (
        <>
          <p className="muted" style={{ marginTop: 12, lineHeight: 1.5 }}>
            <strong>Why:</strong> {recommendation.reason}
          </p>
          <RevenueImpactPanel impact={impact} />
          <MetricPills metrics={recommendation.supportingMetrics} />
          <p className="confidence" style={{ marginTop: 10 }}>
            Confidence: {Math.round(recommendation.confidenceScore * 100)}%
          </p>
          <RecommendationFeedback recommendationId={recommendation.id} />
        </>
      )}

      {showActions ? (
        <div style={{ marginTop: 16 }}>
          <RecommendationLifecycleActions
            recommendation={recommendation}
            approvalStatus={optimisticStatus}
            snoozedUntil={snoozedUntil}
            showExplain={showExplain}
            onExplain={handleExplain}
            explainLoading={explainLoading}
            onStatusChange={setOptimisticStatus}
          />
          <OpportunityInsightActions recommendationId={recommendation.id} />
        </div>
      ) : (
        <div style={{ marginTop: 16 }}>
          <div className="actions-row">
            <a href={`/recommendations/${recommendation.id}`} className="btn btn-primary">
              View details
            </a>
          </div>
          <OpportunityInsightActions
            recommendationId={recommendation.id}
            showExplain={showExplain}
            onExplain={handleExplain}
            explainLoading={explainLoading}
          />
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
