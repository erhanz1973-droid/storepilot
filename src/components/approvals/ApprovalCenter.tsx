"use client";

import { useState } from "react";
import { ApprovalBriefingCard } from "@/components/approvals/ApprovalBriefingCard";
import { OpportunityApprovalCard } from "@/components/approvals/OpportunityApprovalCard";
import { RecommendationCard } from "@/components/RecommendationCard";
import { StoreStatusCard } from "@/components/store-status/StoreStatusCard";
import type { ApprovalPresentation } from "@/lib/approvals/presenter";

function LifecycleSection({
  title,
  description,
  items,
  className,
}: {
  title: string;
  description: string;
  items: ApprovalPresentation["awaitingImplementation"];
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

export function ApprovalCenter({ presentation }: { presentation: ApprovalPresentation }) {
  const [showAll, setShowAll] = useState(false);

  const visibleCards = showAll
    ? presentation.allOpportunities
    : presentation.topOpportunities;

  const hiddenCount = presentation.allOpportunities.length - presentation.topOpportunities.length;

  return (
    <>
      <ApprovalBriefingCard presentation={presentation} />

      {presentation.awaitingImplementation.length > 0 && (
        <LifecycleSection
          title={`Ready to Implement (${presentation.awaitingImplementation.length})`}
          description="Approved — mark implemented after applying changes in your store."
          items={presentation.awaitingImplementation}
          className="lifecycle-section-approved"
        />
      )}

      {!presentation.hasActionableOpportunities && presentation.storeStatus ? (
        <StoreStatusCard status={presentation.storeStatus} />
      ) : (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3>Today&apos;s Top Opportunities</h3>
          <p className="muted" style={{ margin: "0 0 16px" }}>
            Ranked by expected net profit impact, confidence, and effort — maximum 5 shown
          </p>

          <div className="stack">
            {visibleCards.map((card) => (
              <OpportunityApprovalCard key={card.key} card={card} />
            ))}
          </div>

          {hiddenCount > 0 && (
            <div style={{ marginTop: 20, textAlign: "center" }}>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setShowAll((v) => !v)}
              >
                {showAll
                  ? "Show top 5 only"
                  : `View All Recommendations (${presentation.allOpportunities.length})`}
              </button>
            </div>
          )}
        </div>
      )}

      <LifecycleSection
        title={`Measuring (${presentation.measuring.length})`}
        description="Waiting for measurement window — results appear automatically."
        items={presentation.measuring}
        className="lifecycle-section-measuring"
      />

      <LifecycleSection
        title={`Measured Outcomes (${presentation.measured.length})`}
        description="Closed-loop results — expected vs actual impact."
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
    </>
  );
}
