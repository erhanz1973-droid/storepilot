"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AiTrackRecordCard } from "@/components/approvals/AiTrackRecordCard";
import { DecisionMemoCard } from "@/components/approvals/DecisionMemoCard";
import { ExecutiveDecisionBriefingCard } from "@/components/approvals/ExecutiveDecisionBriefingCard";
import { SimilarDecisionsCard } from "@/components/approvals/SimilarDecisionsCard";
import { RecommendationCard } from "@/components/RecommendationCard";
import { StoreStatusCard } from "@/components/store-status/StoreStatusCard";
import type { DecisionCenterView } from "@/lib/approvals/decision-center-types";
import Link from "next/link";

type DecisionCenterViewWithPlan = DecisionCenterView & {
  planUsage?: import("@/lib/billing/types").CampaignEntitlements;
  lockedDecisionCount?: number;
  lockedDecisions?: import("@/lib/billing/apply-approval-entitlements").DecisionMemoWithPlan[];
};

function LifecycleSection({
  title,
  description,
  items,
  className,
}: {
  title: string;
  description: string;
  items: DecisionCenterView["presentation"]["awaitingImplementation"];
  className?: string;
}) {
  if (items.length === 0) return null;
  return (
    <div className={`card ${className ?? ""}`} style={{ marginBottom: 16 }}>
      <h3>{title}</h3>
      <p className="muted" style={{ margin: "0 0 16px" }}>
        {description}
      </p>
      <div className="stack">
        {items.map((item) => (
          <RecommendationCard
            key={item.id}
            recommendation={item}
            approvalStatus={item.approval.status}
            snoozedUntil={item.approval.snoozedUntil}
            showActions
            showExplain
          />
        ))}
      </div>
    </div>
  );
}

export function ApprovalDecisionCenter({ view }: { view: DecisionCenterViewWithPlan }) {
  const { briefing, primaryDecision, additionalDecisions, presentation, trackRecord } = view;
  const searchParams = useSearchParams();
  const focusRecommendationId = searchParams.get("recommendationId");

  const allDecisions = primaryDecision
    ? [primaryDecision, ...additionalDecisions]
    : additionalDecisions;

  const focusedIndex = focusRecommendationId
    ? allDecisions.findIndex((d) => d.primaryRecommendationId === focusRecommendationId)
    : -1;

  const [activeIndex, setActiveIndex] = useState(focusedIndex >= 0 ? focusedIndex : 0);

  useEffect(() => {
    if (focusedIndex >= 0) setActiveIndex(focusedIndex);
  }, [focusedIndex]);

  const activeDecision = allDecisions[activeIndex] ?? null;

  return (
    <>
      <ExecutiveDecisionBriefingCard briefing={briefing} />

      {trackRecord && <AiTrackRecordCard record={trackRecord} />}

      {view.similarDecisions.length > 0 && (
        <SimilarDecisionsCard decisions={view.similarDecisions} />
      )}

      {!presentation.hasActionableOpportunities && presentation.storeStatus ? (
        <StoreStatusCard status={presentation.storeStatus} />
      ) : activeDecision ? (
        <section className="decision-center-primary">
          <div className="decision-center-primary-header">
            <div>
              <h3>Today&apos;s Decision</h3>
              <p className="muted" style={{ margin: "4px 0 0", fontSize: "0.88rem" }}>
                {allDecisions.length > 1
                  ? `Decision ${activeIndex + 1} of ${allDecisions.length} — ranked by profit impact`
                  : "Highest-impact recommendation requiring your approval"}
              </p>
            </div>
            {allDecisions.length > 1 && (
              <div className="decision-center-nav">
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={activeIndex === 0}
                  onClick={() => setActiveIndex((i) => Math.max(0, i - 1))}
                >
                  Previous
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={activeIndex >= allDecisions.length - 1}
                  onClick={() => setActiveIndex((i) => Math.min(allDecisions.length - 1, i + 1))}
                >
                  Next Decision
                </button>
              </div>
            )}
          </div>

          <DecisionMemoCard memo={activeDecision} featured />

          {allDecisions.length > 1 && (
            <div className="decision-center-queue">
              <p className="muted" style={{ margin: "0 0 8px", fontSize: "0.82rem" }}>
                All pending decisions
              </p>
              <div className="decision-center-queue-tabs">
                {allDecisions.map((d, i) => (
                  <button
                    key={d.card.key}
                    type="button"
                    className={`decision-queue-tab ${i === activeIndex ? "is-active" : ""}`}
                    onClick={() => setActiveIndex(i)}
                  >
                    <span>{d.title}</span>
                    <strong>{d.impactPresentation.heroValueFormatted}</strong>
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>
      ) : null}

      {(view.lockedDecisionCount ?? 0) > 0 && view.lockedDecisions && view.planUsage && (
        <section className="card plan-locked-decisions" style={{ marginBottom: 16 }}>
          <h3 style={{ marginTop: 0 }}>
            Locked Recommendations ({view.lockedDecisionCount})
          </h3>
          <p className="muted" style={{ margin: "0 0 12px", fontSize: "0.9rem" }}>
            Visible but locked on Free — approval workflow available for{" "}
            <strong>{view.planUsage.unlockedCampaignName}</strong> only.
          </p>
          <ul className="plan-locked-decision-list">
            {view.lockedDecisions.map((d) => (
              <li key={d!.card.key} className="plan-locked-decision-item">
                <span className="adv-lock-label">🔒 {d!.title}</span>
                <span className="muted">{d!.planLockMessage}</span>
              </li>
            ))}
          </ul>
          <Link href="/settings#plan" className="btn btn-primary btn-sm" style={{ marginTop: 12 }}>
            Upgrade to {view.planUsage.upgradePlanLabel}
          </Link>
        </section>
      )}

      <LifecycleSection
        title={`Ready to Implement (${presentation.awaitingImplementation.length})`}
        description="Approved — mark implemented after applying changes in your store."
        items={presentation.awaitingImplementation}
        className="lifecycle-section-approved"
      />

      <LifecycleSection
        title={`Measuring Impact (${presentation.measuring.length})`}
        description="StorePilot is measuring results — outcomes appear when the window closes."
        items={presentation.measuring}
        className="lifecycle-section-measuring"
      />

      <LifecycleSection
        title={`Completed Decisions (${presentation.measured.length})`}
        description="Closed-loop results — expected vs actual impact with accuracy scores."
        items={presentation.measured}
        className="lifecycle-section-measured"
      />

      {presentation.decided.length > 0 && (
        <div className="card">
          <h3>Ignored &amp; Snoozed ({presentation.decided.length})</h3>
          <div className="stack">
            {presentation.decided.map((item) => (
              <RecommendationCard
                key={item.id}
                recommendation={item}
                approvalStatus={item.approval.status}
                snoozedUntil={item.approval.snoozedUntil}
                showActions
                showExplain
                compact
              />
            ))}
          </div>
        </div>
      )}

      <section className="card decision-center-vision">
        <p className="decision-exec-eyebrow">Long-term vision</p>
        <p className="muted" style={{ margin: 0, lineHeight: 1.55, fontSize: "0.9rem" }}>
          {view.visionStatement}
        </p>
      </section>
    </>
  );
}
