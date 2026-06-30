"use client";

import { EvidenceExplorerPanel } from "@/components/evidence/EvidenceExplorerPanel";
import { SimulationWorkbench } from "@/components/simulations/SimulationWorkbench";
import type { RecommendationEvidence } from "@/lib/evidence/types";
import { useState } from "react";

type Props = {
  recommendationId?: string;
  opportunityId?: string;
  showExplain?: boolean;
  onExplain?: () => void;
  explainLoading?: boolean;
};

export function OpportunityInsightActions({
  recommendationId,
  opportunityId,
  showExplain,
  onExplain,
  explainLoading,
}: Props) {
  const [evidence, setEvidence] = useState<RecommendationEvidence | null>(null);
  const [showSimulate, setShowSimulate] = useState(false);
  const [evidenceLoading, setEvidenceLoading] = useState(false);

  async function loadEvidence() {
    setEvidenceLoading(true);
    try {
      const res = await fetch("/api/evidence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recommendationId, opportunityId }),
      });
      if (res.ok) {
        const data = (await res.json()) as { evidence: RecommendationEvidence };
        setEvidence(data.evidence);
      }
    } finally {
      setEvidenceLoading(false);
    }
  }

  return (
    <>
      <div className="actions-row opportunity-insight-actions">
        <button
          type="button"
          className="btn btn-ghost"
          disabled={evidenceLoading}
          onClick={() => {
            if (evidence) {
              setEvidence(null);
            } else {
              loadEvidence();
            }
          }}
        >
          {evidenceLoading ? "…" : evidence ? "Hide evidence" : "Evidence"}
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => setShowSimulate((v) => !v)}
        >
          {showSimulate ? "Hide simulate" : "Simulate"}
        </button>
        {showExplain && onExplain && (
          <button
            type="button"
            className="btn btn-ghost"
            disabled={explainLoading}
            onClick={onExplain}
          >
            {explainLoading ? "…" : "Explain"}
          </button>
        )}
      </div>

      {evidence && (
        <div style={{ marginTop: 16 }}>
          <EvidenceExplorerPanel evidence={evidence} onClose={() => setEvidence(null)} />
        </div>
      )}

      {showSimulate && (
        <div style={{ marginTop: 16 }}>
          <SimulationWorkbench
            recommendationId={recommendationId}
            opportunityId={opportunityId}
            onClose={() => setShowSimulate(false)}
          />
        </div>
      )}
    </>
  );
}
