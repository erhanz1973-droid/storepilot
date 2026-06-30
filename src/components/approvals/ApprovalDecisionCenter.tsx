"use client";

import { useState } from "react";
import { DecisionMemoCard } from "@/components/approvals/DecisionMemoCard";
import { ExecutiveDecisionBriefingCard } from "@/components/approvals/ExecutiveDecisionBriefingCard";
import { RecommendationCard } from "@/components/RecommendationCard";
import { StoreStatusCard } from "@/components/store-status/StoreStatusCard";
import type { DecisionCenterView } from "@/lib/approvals/decision-center-types";

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

export function ApprovalDecisionCenter({ view }: { view: DecisionCenterView }) {
  const { briefing, primaryDecision, additionalDecisions, presentation } = view;
  const [activeIndex, setActiveIndex] = useState(0);

  const allDecisions = primaryDecision
    ? [primaryDecision, ...additionalDecisions]
    : additionalDecisions;
  const activeDecision = allDecisions[activeIndex] ?? null;

  return (
    <>
      <ExecutiveDecisionBriefingCard briefing={briefing} />

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
                    <strong>+${d.card.netProfitImpact.toLocaleString()}</strong>
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>
      ) : null}

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
