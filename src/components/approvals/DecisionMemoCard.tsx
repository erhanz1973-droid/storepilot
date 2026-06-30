"use client";

import { DecisionForecastPanel } from "@/components/approvals/DecisionForecastPanel";
import { DecisionLifecycleTrack } from "@/components/approvals/DecisionLifecycleTrack";
import { DecisionMeasuredResults } from "@/components/approvals/DecisionMeasuredResults";
import { ExplainPanel } from "@/components/ask-ai/ExplainPanel";
import { EvidenceExplorerPanel } from "@/components/evidence/EvidenceExplorerPanel";
import { RecommendationLifecycleActions } from "@/components/RecommendationLifecycleActions";
import { SimulationWorkbench } from "@/components/simulations/SimulationWorkbench";
import type { DecisionMemo } from "@/lib/approvals/decision-center-types";
import type { RecommendationExplanation } from "@/lib/ai/types";
import type { RecommendationEvidence } from "@/lib/evidence/types";
import { resolveRecommendationStatus } from "@/lib/recommendations/lifecycle";
import { useState } from "react";

function fmtImpact(n: number): string {
  if (n <= 0) return "—";
  return `+${n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 })}`;
}

const RISK_CLASS = {
  Low: "risk-low",
  Medium: "risk-medium",
  High: "risk-high",
} as const;

export function DecisionMemoCard({ memo, featured = false }: { memo: DecisionMemo; featured?: boolean }) {
  const primary = memo.card.members[0];
  const [showEvidence, setShowEvidence] = useState(false);
  const [showSimulate, setShowSimulate] = useState(false);
  const [evidence, setEvidence] = useState<RecommendationEvidence | null>(null);
  const [explanation, setExplanation] = useState<RecommendationExplanation | null>(null);
  const [evidenceLoading, setEvidenceLoading] = useState(false);
  const [explainLoading, setExplainLoading] = useState(false);

  const status = primary
    ? resolveRecommendationStatus(primary, primary.approval.status)
    : memo.lifecycleStatus;

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
    } finally {
      setEvidenceLoading(false);
    }
  }

  async function loadExplanation() {
    if (!memo.primaryRecommendationId) return;
    setExplainLoading(true);
    try {
      const res = await fetch("/api/ask-ai/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recommendationId: memo.primaryRecommendationId }),
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
    <article className={`decision-memo-card ${featured ? "is-featured" : ""}`}>
      <DecisionLifecycleTrack status={status} />

      <header className="decision-memo-header">
        <span className="category-tag">{memo.subtitle}</span>
        <h4>{memo.title}</h4>
      </header>

      <div className="decision-memo-impact-row">
        <div>
          <span className="muted">Expected Monthly Impact</span>
          <strong className="decision-exec-positive">{fmtImpact(memo.card.netProfitImpact)}</strong>
        </div>
        <div>
          <span className="muted">Confidence</span>
          <strong>{Math.round(memo.card.confidenceScore * 100)}%</strong>
        </div>
        <div>
          <span className="muted">Risk</span>
          <strong className={`decision-memo-risk ${RISK_CLASS[memo.riskLevel]}`}>
            {memo.riskLevel}
          </strong>
        </div>
      </div>

      <section className="decision-memo-section">
        <h5>Reason</h5>
        <p>{memo.reason}</p>
      </section>

      {memo.evidence.length > 0 && (
        <section className="decision-memo-section">
          <h5>Evidence</h5>
          <ul className="decision-memo-evidence">
            {memo.evidence.map((m) => (
              <li key={`${m.label}-${m.value}`}>
                <strong>{m.label}:</strong> {m.value}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="decision-memo-section decision-memo-urgency">
        <h5>Why this matters</h5>
        <p>{memo.whyItMatters}</p>
      </section>

      <section className="decision-memo-section">
        <h5>Expected Result</h5>
        <p>{memo.expectedResult}</p>
      </section>

      <DecisionForecastPanel forecast={memo.forecast} />

      {memo.measuredOutcome && <DecisionMeasuredResults outcome={memo.measuredOutcome} />}

      {memo.card.isCampaignPortfolio && memo.card.campaignBrief && (
        <div className="campaign-brief-stats">
          <p style={{ margin: "0 0 8px", fontWeight: 600 }}>{memo.card.campaignBrief.platform}</p>
          <ul className="campaign-brief-list">
            <li>{memo.card.campaignBrief.scanned} campaigns analyzed</li>
            <li>Needs review: {memo.card.campaignBrief.needsReview}</li>
          </ul>
        </div>
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
            <button type="button" className="btn btn-ghost" disabled={explainLoading} onClick={loadExplanation}>
              {explainLoading ? "…" : "Explain with AI"}
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

      {explanation && (
        <div style={{ marginTop: 16 }}>
          <ExplainPanel explanation={explanation} onClose={() => setExplanation(null)} />
        </div>
      )}
    </article>
  );
}
