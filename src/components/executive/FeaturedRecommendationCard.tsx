import type { FeaturedRecommendation } from "@/lib/analytics/executive-experience";
import { RecommendationActionButtons } from "./RecommendationActionButtons";

function fmtImpact(n: number, label: string): string {
  if (label.includes("$")) return label;
  return n > 0 ? `+$${n.toLocaleString()}/month` : label;
}

export function FeaturedRecommendationCard({ rec }: { rec: FeaturedRecommendation }) {
  const isSavings = rec.impactLabel.toLowerCase().includes("saving");

  return (
    <section className="exec-featured-rec card">
      <p className="exec-featured-eyebrow">Top Recommendation</p>
      <h3 className="exec-featured-title">{rec.title}</h3>
      <p className="exec-featured-desc muted">{rec.description}</p>

      <div className="exec-featured-metrics">
        <div className="exec-featured-metric">
          <span className="muted">Estimated {isSavings ? "savings" : "impact"}</span>
          <strong>{fmtImpact(rec.impactMonthly, rec.impactLabel)}</strong>
        </div>
        <div className="exec-featured-metric">
          <span className="muted">Confidence</span>
          <strong>{rec.confidencePct}%</strong>
        </div>
      </div>

      <p className="exec-featured-action">
        <span className="muted">Suggested action:</span> {rec.suggestedAction}
      </p>

      <RecommendationActionButtons
        payload={{
          decisionId: rec.decisionId,
          recommendationId: rec.recommendationId,
          opportunityKey: rec.opportunityKey,
          title: rec.title,
          confidencePct: rec.confidencePct,
          expectedImpactLabel: rec.impactLabel,
          futureAction: rec.futureAction,
        }}
        buttons={[
          {
            id: "primary",
            label: rec.primaryActionLabel,
            action: "approve",
            variant: "primary",
          },
          {
            id: "secondary",
            label: rec.secondaryActionLabels[0] ?? "Reduce Budget",
            action: "later",
            variant: "secondary",
          },
          {
            id: "ignore",
            label: rec.secondaryActionLabels[1] ?? "Ignore",
            action: "reject",
            variant: "ghost",
          },
        ]}
      />
    </section>
  );
}
