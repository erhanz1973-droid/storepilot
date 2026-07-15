"use client";

import { ActionPlanCard } from "@/components/approvals/ActionPlanCard";
import { AiReasoningCard } from "@/components/approvals/AiReasoningCard";
import { ApprovalPreviewCard } from "@/components/approvals/ApprovalPreviewCard";
import { BusinessContextCard } from "@/components/approvals/BusinessContextCard";
import { CampaignEvidenceTable } from "@/components/approvals/CampaignEvidenceTable";
import { CollapsibleSection } from "@/components/approvals/CollapsibleSection";
import { ConfidenceBreakdownCard } from "@/components/approvals/ConfidenceBreakdownCard";
import { DecisionDetailsSection } from "@/components/approvals/DecisionDetailsSection";
import { DecisionMeasuredResults } from "@/components/approvals/DecisionMeasuredResults";
import { DecisionTimeline } from "@/components/approvals/DecisionTimeline";
import { ExpectedKpiCards } from "@/components/approvals/ExpectedKpiCards";
import { ExplainNarrativePanel } from "@/components/approvals/ExplainNarrativePanel";
import { FinancialImpactExplanationPanel } from "@/components/approvals/FinancialImpactExplanationPanel";
import { RiskAnalysisCard } from "@/components/approvals/RiskAnalysisCard";
import { SimulationComparisonPanel } from "@/components/approvals/SimulationComparisonPanel";
import { EvidenceExplorerPanel } from "@/components/evidence/EvidenceExplorerPanel";
import { RecommendationLifecycleActions } from "@/components/RecommendationLifecycleActions";
import { SimulationWorkbench } from "@/components/simulations/SimulationWorkbench";
import type { DecisionMemo } from "@/lib/approvals/decision-center-types";
import type { RecommendationEvidence } from "@/lib/evidence/types";
import { useState } from "react";

export function DecisionMemoCard({ memo, featured = false }: { memo: DecisionMemo; featured?: boolean }) {
  const primary = memo.card.members[0];
  const [showEvidence, setShowEvidence] = useState(false);
  const [showSimulate, setShowSimulate] = useState(false);
  const [showExplain, setShowExplain] = useState(false);
  const [evidence, setEvidence] = useState<RecommendationEvidence | null>(null);
  const [evidenceLoading, setEvidenceLoading] = useState(false);

  async function loadEvidence() {
    if (!memo.primaryRecommendationId) return;
    setEvidenceLoading(true);
    try {
      const res = await fetch("/api/evidence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recommendationId: memo.primaryRecommendationId }),
      });
      if (res.ok) {
        const data = (await res.json()) as { evidence: RecommendationEvidence };
        setEvidence(data.evidence);
        setShowEvidence(true);
      }
    } catch {
      // User can retry; avoid unhandled rejection overlay.
    } finally {
      setEvidenceLoading(false);
    }
  }

  return (
    <article className={`decision-memo-card ${featured ? "is-featured" : ""}`}>
      <header className="decision-memo-header">
        <span className="category-tag">{memo.subtitle}</span>
        <h4>{memo.title}</h4>
      </header>

      <DecisionDetailsSection
        details={memo.decisionDetails}
        impactPresentation={memo.impactPresentation}
        supportingFactors={memo.profitCalculation}
      />

      <ExpectedKpiCards kpis={memo.expectedKpis} />

      {memo.financialImpactExplanation && (
        <FinancialImpactExplanationPanel explanation={memo.financialImpactExplanation} />
      )}

      <ApprovalPreviewCard preview={memo.approvalPreview} />

      <ActionPlanCard items={memo.actionPlan} />

      <CollapsibleSection
        title="Risk Assessment"
        summary={`Overall risk: ${memo.riskAnalysis.overallRisk} — quantified estimates inside`}
      >
        <RiskAnalysisCard analysis={memo.riskAnalysis} />
      </CollapsibleSection>

      <CollapsibleSection
        title="AI Confidence"
        summary={`${memo.confidenceBreakdown.confidencePct}% — ${memo.confidenceBreakdown.qualitativeLabel}`}
      >
        <ConfidenceBreakdownCard breakdown={memo.confidenceBreakdown} />
      </CollapsibleSection>

      {memo.campaignEvidence.length > 0 && (
        <CollapsibleSection
          title="Campaign Evidence"
          summary={`${memo.campaignEvidence.length} campaign${memo.campaignEvidence.length === 1 ? "" : "s"} analyzed`}
        >
          <CampaignEvidenceTable rows={memo.campaignEvidence} />
        </CollapsibleSection>
      )}

      <CollapsibleSection title="Business Context" summary="Strategy selection and alternatives evaluated">
        <BusinessContextCard context={memo.businessContext} />
      </CollapsibleSection>

      <CollapsibleSection title="AI Reasoning" summary={`${memo.aiReasoning.signalCount} performance signals analyzed`}>
        <AiReasoningCard reasoning={memo.aiReasoning} />
      </CollapsibleSection>

      <CollapsibleSection title="Decision Progress" summary="From data collection to measured impact">
        <DecisionTimeline events={memo.timeline} />
      </CollapsibleSection>

      {memo.evidence.length > 0 && (
        <CollapsibleSection title="Supporting Data" summary={`${memo.evidence.length} supporting metrics`}>
          <section className="decision-memo-section decision-supporting-inline">
            <ul className="decision-memo-evidence">
              {memo.evidence.map((m) => (
                <li key={`${m.label}-${m.value}`}>
                  <strong>{m.label}:</strong> {m.value}
                </li>
              ))}
            </ul>
          </section>
        </CollapsibleSection>
      )}

      {showSimulate && memo.simulationComparison && (
        <SimulationComparisonPanel comparison={memo.simulationComparison} />
      )}

      {memo.measuredOutcome && <DecisionMeasuredResults outcome={memo.measuredOutcome} />}

      {showExplain && (
        <ExplainNarrativePanel narrative={memo.explainNarrative} onClose={() => setShowExplain(false)} />
      )}

      {primary && (
        <div className="decision-memo-actions">
          <p className="decision-memo-actions-label">Merchant Actions</p>
          <RecommendationLifecycleActions
            recommendation={primary}
            approvalStatus={primary.approval.status}
            snoozedUntil={primary.approval.snoozedUntil}
            showExplain={false}
            ignoreLabel="Reject"
          />
          <div className="actions-row decision-memo-secondary-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setShowExplain((v) => !v)}>
              {showExplain ? "Hide Explanation" : "Explain with AI"}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setShowSimulate((v) => !v)}
            >
              {showSimulate ? "Hide Simulation" : "Run Simulation"}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={evidenceLoading}
              onClick={() => {
                if (showEvidence) {
                  setShowEvidence(false);
                  setEvidence(null);
                } else {
                  loadEvidence();
                }
              }}
            >
              {evidenceLoading ? "…" : showEvidence ? "Hide Data" : "View Supporting Data"}
            </button>
          </div>
        </div>
      )}

      {showSimulate && memo.primaryRecommendationId && (
        <div style={{ marginTop: 16 }}>
          <SimulationWorkbench
            recommendationId={memo.primaryRecommendationId}
            embedded
            onClose={() => setShowSimulate(false)}
          />
        </div>
      )}

      {showEvidence && evidence && (
        <div style={{ marginTop: 16 }}>
          <EvidenceExplorerPanel evidence={evidence} onClose={() => setShowEvidence(false)} />
        </div>
      )}
    </article>
  );
}
