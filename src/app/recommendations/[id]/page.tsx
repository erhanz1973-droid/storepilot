import { RecommendationInsightPanels } from "@/components/recommendations/RecommendationInsightPanels";
import { RecommendationTimeline } from "@/components/recommendations/RecommendationTimeline";
import { RecommendationEvidencePanel } from "@/components/recommendations/RecommendationEvidencePanel";
import { RecommendationExplanationView } from "@/components/RecommendationExplanationView";
import { RecommendationOutcomePanel } from "@/components/RecommendationOutcomePanel";
import { RecommendationDetailActions } from "@/components/RecommendationDetailActions";
import { buildBusinessContext } from "@/lib/ai/context-engine";
import { explainRecommendation } from "@/lib/ai/explain";
import { buildRecommendationEvidence } from "@/lib/evidence/explorer";
import { getRecommendationById } from "@/lib/db/recommendations";
import { listLifecycleEvents } from "@/lib/db/recommendation-intelligence";
import { getLatestAuditByRecommendationId } from "@/lib/recommendations/validation/audit";
import { getVerifiedStoreData } from "@/lib/recommendations/validation";
import { resolveActiveStoreId } from "@/lib/store/context";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function RecommendationDetailPage({ params }: Props) {
  const { id } = await params;
  const storeId = await resolveActiveStoreId();
  const recommendation = await getRecommendationById(id);

  if (!recommendation) {
    notFound();
  }

  const explanation = explainRecommendation(recommendation);
  const context = await buildBusinessContext();
  const evidence = await buildRecommendationEvidence(context, { recommendation });
  const timeline = await listLifecycleEvents(id);
  const audit = await getLatestAuditByRecommendationId(storeId, id);
  const { gate } = await getVerifiedStoreData(storeId);

  const validationMeta = audit
    ? {
        aiConfidence: audit.aiConfidence,
        validationConfidence: audit.validationConfidence,
        finalConfidence: audit.finalConfidence,
        validationScore: audit.validationScore,
        providersUsed: audit.providersUsed,
        providersBlocked: audit.providersBlocked,
        providersWarned: [],
        evidence: audit.evidence,
        calculationBasis: audit.calculationBasis,
        dateRangeVerified: true,
        blocked: false,
      }
    : undefined;

  return (
    <>
      <div className="page-header">
        <h2>{recommendation.title}</h2>
        <p>Complete evidence, lifecycle timeline, and outcome tracking</p>
      </div>

      <RecommendationEvidencePanel
        validation={validationMeta}
        gate={gate}
        confidencePct={Math.round(recommendation.confidenceScore * 100)}
        summary={recommendation.title}
      />

      <RecommendationInsightPanels evidence={evidence} />

      <div className="grid-2" style={{ marginBottom: 16 }}>
        <div className="card">
          <RecommendationDetailActions recommendation={recommendation} />
        </div>
        <RecommendationOutcomePanel recommendation={recommendation} />
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Reason</h3>
        <p style={{ margin: 0, lineHeight: 1.6 }}>{recommendation.reason}</p>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Audit Trail</h3>
        <RecommendationTimeline events={timeline} />
      </div>

      <RecommendationExplanationView explanation={explanation} />
    </>
  );
}
