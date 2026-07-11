import type { PriorityAction, RiskAssessment } from "@/lib/analytics/executive-advisor";
import type { RecommendationHistory } from "@/lib/analytics/executive-ai-behavior";
import { RecommendationActionButtons } from "@/components/executive/RecommendationActionButtons";
import { ExecutiveImpactTimeline } from "@/components/executive/advisor/ExecutiveImpactTimeline";
import { ExecutiveAskAiPanel } from "@/components/executive/advisor/ExecutiveAskAiPanel";
import { ExecutiveRecommendationHistory } from "@/components/executive/advisor/ExecutiveRecommendationHistory";
import { EvidenceStrengthBadge } from "@/components/executive/advisor/EvidenceStrengthBadge";
import { RecommendationWhyPanel } from "@/components/executive/advisor/RecommendationWhyPanel";
import { EXEC_METRIC_ICONS, MetricLabel } from "@/components/executive/advisor/executive-metric-icons";

function fmtImpact(n: number, label: string): string {
  if (label.includes("$")) return label;
  return n > 0 ? `+$${n.toLocaleString()}/month` : label;
}

function fmtLoss(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function riskClass(risk: RiskAssessment): string {
  return `exec-advisor-risk-tag exec-advisor-risk-tag-${risk.label.toLowerCase().replace(/\s+/g, "-")}`;
}

function riskIcon(risk: RiskAssessment): string {
  if (risk.label === "Very Safe" || risk.label === "Low Risk") return EXEC_METRIC_ICONS.riskLow;
  if (risk.label === "Medium Risk") return EXEC_METRIC_ICONS.riskMedium;
  return EXEC_METRIC_ICONS.riskHigh;
}

export function ExecutivePriorityActionCard({
  action,
  compact = false,
  recommendationHistory = null,
}: {
  action: PriorityAction | null;
  compact?: boolean;
  recommendationHistory?: RecommendationHistory | null;
}) {
  if (!action) return null;

  const meta = action.cardMeta;

  return (
    <section className={`exec-advisor-priority card ${compact ? "compact" : ""}`}>
      {!compact && (
        <>
          <p className="exec-featured-eyebrow">If You Only Do One Thing Today</p>
          <h2 className="exec-advisor-priority-title">Today&apos;s Highest Impact Action</h2>
        </>
      )}
      {compact && <p className="exec-advisor-mode-action-label">One Recommended Action</p>}
      <h3 className="exec-featured-title">{action.title}</h3>

      <div className="exec-advisor-priority-metrics exec-advisor-card-meta-grid">
        <div className="exec-featured-metric">
          <MetricLabel icon={EXEC_METRIC_ICONS.opportunity} className="muted">
            Business Impact
          </MetricLabel>
          <strong>{meta.businessImpact}</strong>
        </div>
        <div className="exec-featured-metric">
          <MetricLabel icon={EXEC_METRIC_ICONS.profit} className="muted">
            Financial Impact
          </MetricLabel>
          <strong className="exec-advisor-priority-impact">{meta.financialImpact}</strong>
        </div>
        <div className="exec-featured-metric">
          <MetricLabel icon={EXEC_METRIC_ICONS.time} className="muted">
            Time Required
          </MetricLabel>
          <strong>{meta.timeRequired}</strong>
        </div>
        <div className="exec-featured-metric">
          <MetricLabel icon={EXEC_METRIC_ICONS.difficulty} className="muted">
            Difficulty
          </MetricLabel>
          <strong>{meta.difficulty}</strong>
        </div>
        <div className="exec-featured-metric">
          <MetricLabel icon={EXEC_METRIC_ICONS.riskMedium} className="muted">
            Risk Level
          </MetricLabel>
          <strong>{meta.riskLevel}</strong>
        </div>
        <div className="exec-featured-metric">
          <MetricLabel icon={EXEC_METRIC_ICONS.confidence} className="muted">
            AI Evidence
          </MetricLabel>
          <EvidenceStrengthBadge evidence={action.evidence} />
        </div>
        <div className="exec-featured-metric">
          <MetricLabel icon={EXEC_METRIC_ICONS.success} className="muted">
            Time Until Results
          </MetricLabel>
          <strong>{meta.expectedTimeToResults}</strong>
        </div>
        <div className="exec-featured-metric">
          <MetricLabel icon={EXEC_METRIC_ICONS.opportunity} className="muted">
            Est. Monthly Recovery
          </MetricLabel>
          <strong className="exec-advisor-priority-impact">
            {fmtImpact(action.impactMonthly, action.impactLabel)}
          </strong>
        </div>
      </div>

      <div className={riskClass(action.risk)}>
        <strong>
          <span className="exec-metric-icon" aria-hidden>
            {riskIcon(action.risk)}
          </span>{" "}
          {action.risk.label}
        </strong>
        <p>{action.risk.explanation}</p>
      </div>

      {!compact && (
        <div className="exec-advisor-why-matters">
          <p className="exec-advisor-why-label">Why this matters</p>
          <div className="exec-advisor-why-grid">
            <div>
              <span className="muted">Current situation</span>
              <p>{action.whyThisMatters.currentSituation}</p>
            </div>
            <div>
              <span className="muted">Recommended change</span>
              <p>{action.whyThisMatters.recommendedChange}</p>
            </div>
            <div>
              <span className="muted">Business impact</span>
              <p>{action.whyThisMatters.businessImpact}</p>
            </div>
          </div>
        </div>
      )}

      <RecommendationWhyPanel explanation={meta.explanation} compact={compact} />

      <div className="exec-advisor-inaction">
        <p className="exec-advisor-inaction-label">What happens if I do nothing?</p>
        <ExecutiveImpactTimeline timeline={action.inactionCost.timeline} compact={compact} />
        <p className="muted exec-advisor-inaction-note">{action.inactionCost.explanation}</p>
        {!compact && (
          <p className="exec-advisor-inaction-loss">
            Estimated additional loss over 30 days:{" "}
            <strong>-{fmtLoss(action.inactionCost.additionalLoss30d)}</strong>
          </p>
        )}
      </div>

      <ExecutiveAskAiPanel
        title={action.title}
        recommendationId={action.recommendationId}
        decisionId={action.decisionId}
        compact={compact}
      />

      {recommendationHistory && !compact && (
        <ExecutiveRecommendationHistory history={recommendationHistory} />
      )}

      <RecommendationActionButtons
        payload={{
          decisionId: action.decisionId,
          recommendationId: action.recommendationId,
          opportunityKey: action.opportunityKey,
          title: action.title,
          confidencePct: action.confidencePct,
          expectedImpactLabel: action.impactLabel,
          futureAction: action.futureAction,
        }}
        buttons={action.contextualActions}
      />
    </section>
  );
}
