"use client";

import { RecommendationLifecycleActions } from "@/components/RecommendationLifecycleActions";
import { RecommendationLifecycleStepper } from "@/components/RecommendationLifecycleStepper";
import { SeverityBadge } from "@/components/SeverityBadge";
import { resolveRecommendationStatus } from "@/lib/recommendations/lifecycle";
import type { Recommendation } from "@/lib/types";
import Link from "next/link";
import { useOptimistic } from "react";

const CATEGORY_LABELS: Record<Recommendation["category"], string> = {
  low_inventory: "Low inventory",
  slow_selling: "Slow selling",
  bundle_opportunity: "Bundle opportunity",
  homepage_merchandising: "Homepage merchandising",
  promotion_opportunity: "Promotion opportunity",
  campaign_review: "Campaign review",
};

export function RecommendationDetailActions({
  recommendation,
}: {
  recommendation: Recommendation;
}) {
  const status = resolveRecommendationStatus(recommendation);
  const [optimisticStatus, setOptimisticStatus] = useOptimistic(status);

  return (
    <>
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
          <h3 style={{ margin: "8px 0 0" }}>{recommendation.title}</h3>
        </div>
        <SeverityBadge severity={recommendation.severity} />
      </div>

      <p className="muted" style={{ marginTop: 12, lineHeight: 1.5 }}>
        {recommendation.reason}
      </p>

      <div style={{ marginTop: 16 }}>
        <RecommendationLifecycleActions
          recommendation={recommendation}
          approvalStatus={optimisticStatus}
          onStatusChange={setOptimisticStatus}
        />
      </div>

      <div className="actions-row" style={{ marginTop: 16 }}>
        <Link href="/approvals" className="btn btn-ghost">
          Back to Approvals
        </Link>
      </div>
    </>
  );
}
