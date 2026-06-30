"use client";

import { EvidenceExplorerPanel } from "@/components/evidence/EvidenceExplorerPanel";
import { SimulationWorkbench } from "@/components/simulations/SimulationWorkbench";
import type { RecommendationEvidence } from "@/lib/evidence/types";

export function RecommendationInsightPanels({
  evidence,
}: {
  evidence: RecommendationEvidence;
}) {
  return (
    <div className="grid-2" style={{ marginBottom: 16 }}>
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <EvidenceExplorerPanel evidence={evidence} onClose={() => {}} embedded />
      </div>
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <SimulationWorkbench
          recommendationId={evidence.recommendationId}
          opportunityId={evidence.opportunityId}
          onClose={() => {}}
          embedded
        />
      </div>
    </div>
  );
}
