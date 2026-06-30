import { MetricPills } from "@/components/MetricPills";
import { BusinessActionDetails } from "@/components/decisions/BusinessActionDetails";
import { DecisionCardActions } from "@/components/decisions/DecisionCardActions";
import { DecisionConfidenceBreakdownPanel } from "@/components/decisions/DecisionConfidenceBreakdown";
import { DecisionExplainabilityBadge } from "@/components/decisions/DecisionExplainabilityBadge";
import { DecisionProfitWaterfall } from "@/components/decisions/DecisionProfitWaterfall";
import { DecisionStrategyComparison } from "@/components/decisions/DecisionStrategyComparison";
import { ExecutionStatusBadge } from "@/components/execution/ExecutionStatusBadge";
import { ShopifyScopeAlert } from "@/components/execution/ShopifyScopeAlert";
import { OutcomeCard } from "@/components/outcomes/OutcomeCard";
import { RecommendationEvidencePanel } from "@/components/recommendations/RecommendationEvidencePanel";
import { getActionCapability } from "@/lib/insights/actions";
import type { FutureActionType } from "@/lib/insights/actions";
import type { DecisionItem } from "@/lib/decisions/center";

const PRIORITY_BADGE: Record<DecisionItem["priority"], string> = {
  critical: "badge-critical",
  high: "badge-high",
  medium: "badge-medium",
  low: "badge-low",
};

type Props = {
  item: DecisionItem;
  showActions?: boolean;
};

export function DecisionCard({ item, showActions = true }: Props) {
  const action = item.futureAction ? getActionCapability(item.futureAction as FutureActionType) : undefined;
  const confidencePct = item.confidenceBreakdown?.overallPct ?? item.confidencePct;

  return (
    <article id={item.id} className="card decision-card">
      <div className="decision-card-top">
        <span className={`badge ${PRIORITY_BADGE[item.priority]}`}>{item.priority}</span>
        <span className="muted" style={{ fontSize: "0.8rem" }}>
          {item.estimatedImpactLabel}
        </span>
        <div className="decision-confidence">
          <strong>{confidencePct}%</strong>
          <span className="muted">confidence</span>
        </div>
        {item.explainability && (
          <DecisionExplainabilityBadge explainability={item.explainability} />
        )}
      </div>

      <h3 className="decision-card-title">{item.summary}</h3>

      <div style={{ marginBottom: 16 }}>
        <ExecutionStatusBadge
          availability={item.executionAvailability}
          missingShopifyScopes={item.missingShopifyScopes}
        />
      </div>

      <ShopifyScopeAlert item={item} />

      {item.strategyExplanation && (
        <DecisionStrategyComparison explanation={item.strategyExplanation} />
      )}

      {!item.strategyExplanation && (
        <div className="decision-card-section">
          <p className="decision-section-label">AI explanation</p>
          <p className="decision-section-body" style={{ whiteSpace: "pre-line" }}>
            {item.why}
          </p>
        </div>
      )}

      {item.supportingMetrics.length > 0 && !item.isGroupedAction && (
        <div className="decision-card-section">
          <p className="decision-section-label">Evidence</p>
          <MetricPills metrics={item.supportingMetrics} />
        </div>
      )}

      {item.isGroupedAction ? (
        <BusinessActionDetails item={item} />
      ) : (
        <div className="decision-card-section">
          <p className="decision-section-label">Recommended decision</p>
          <p className="decision-section-body">{item.recommendedAction}</p>
        </div>
      )}

      {item.profitWaterfall && <DecisionProfitWaterfall waterfall={item.profitWaterfall} />}

      {item.confidenceBreakdown && (
        <DecisionConfidenceBreakdownPanel breakdown={item.confidenceBreakdown} />
      )}

      {(item.validation || item.validationGate) && (
        <RecommendationEvidencePanel
          validation={item.validation}
          gate={item.validationGate}
          confidencePct={confidencePct}
          summary={item.summary}
        />
      )}

      {action && (
        <p className="muted" style={{ margin: "8px 0 0", fontSize: "0.82rem" }}>
          {action.label} ·{" "}
          {item.actionAvailable
            ? "Automation available after approval"
            : "Manual execution — StorePilot will prepare the steps"}
        </p>
      )}

      {showActions && <DecisionCardActions item={item} />}

      {item.outcome && (
        <div style={{ marginTop: 16 }}>
          <OutcomeCard title={item.summary} outcome={item.outcome} compact />
        </div>
      )}
    </article>
  );
}
