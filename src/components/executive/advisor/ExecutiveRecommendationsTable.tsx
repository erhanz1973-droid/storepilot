"use client";

import Link from "next/link";
import { Fragment, useMemo, useState } from "react";
import type { RecommendationRow } from "@/lib/analytics/executive-advisor";
import { RecommendationActionButtons } from "@/components/executive/RecommendationActionButtons";
import { ExecutiveImpactTimeline } from "@/components/executive/advisor/ExecutiveImpactTimeline";
import { ExecutiveAskAiPanel } from "@/components/executive/advisor/ExecutiveAskAiPanel";
import { ExecutiveRecommendationHistory } from "@/components/executive/advisor/ExecutiveRecommendationHistory";
import { EvidenceStrengthBadge } from "@/components/executive/advisor/EvidenceStrengthBadge";
import { RecommendationWhyPanel } from "@/components/executive/advisor/RecommendationWhyPanel";

type SortKey = "impact" | "evidence" | "time" | "risk";

function fmt(n: number) {
  return `+$${n.toLocaleString()}`;
}

const RISK_ORDER: Record<RecommendationRow["risk"]["label"], number> = {
  "Very Safe": 0,
  "Low Risk": 1,
  "Medium Risk": 2,
  "High Risk": 3,
};

const EVIDENCE_ORDER = { Strong: 0, Moderate: 1, Limited: 2 } as const;

export function ExecutiveRecommendationsTable({
  rows,
  recommendationHistories = [],
}: {
  rows: RecommendationRow[];
  recommendationHistories?: import("@/lib/analytics/executive-ai-behavior").RecommendationHistory[];
}) {
  const [sortBy, setSortBy] = useState<SortKey>("impact");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      if (sortBy === "impact") return b.expectedMonthlyProfit - a.expectedMonthlyProfit;
      if (sortBy === "evidence") {
        return (
          EVIDENCE_ORDER[a.evidence.strength] - EVIDENCE_ORDER[b.evidence.strength]
        );
      }
      if (sortBy === "risk") return RISK_ORDER[a.risk.label] - RISK_ORDER[b.risk.label];
      return a.timeRequired.localeCompare(b.timeRequired);
    });
    return copy;
  }, [rows, sortBy]);

  if (rows.length === 0) return null;

  return (
    <section className="exec-advisor-table-section card">
      <div className="exec-advisor-table-header">
        <h2 className="exec-advisor-section-title">Opportunity Prioritization</h2>
        <div className="exec-advisor-table-sort">
          <span className="muted">Sort by:</span>
          {(
            [
              ["impact", "Impact"],
              ["evidence", "Evidence"],
              ["time", "Time"],
              ["risk", "Risk"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={`btn btn-ghost exec-advisor-sort-btn ${sortBy === key ? "active" : ""}`}
              onClick={() => setSortBy(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="exec-advisor-table-wrap">
        <table className="exec-advisor-table">
          <thead>
            <tr>
              <th>Opportunity</th>
              <th>Financial Impact</th>
              <th>AI Evidence</th>
              <th>Difficulty</th>
              <th>Time Required</th>
              <th>Risk</th>
              <th>Results In</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => (
              <Fragment key={row.id}>
                <tr
                  className="exec-advisor-table-row"
                  onClick={() => setExpandedId(expandedId === row.id ? null : row.id)}
                >
                  <td>
                    <button type="button" className="exec-advisor-table-opportunity">
                      {row.opportunity}
                    </button>
                    <span className="muted exec-advisor-table-business-impact">
                      {row.cardMeta.businessImpact.slice(0, 72)}
                      {row.cardMeta.businessImpact.length > 72 ? "…" : ""}
                    </span>
                  </td>
                  <td className="exec-advisor-table-profit">{fmt(row.expectedMonthlyProfit)}</td>
                  <td>
                    <EvidenceStrengthBadge evidence={row.evidence} />
                  </td>
                  <td>{row.cardMeta.difficulty}</td>
                  <td>{row.timeRequired}</td>
                  <td>
                    <span
                      className={`exec-advisor-risk-tag exec-advisor-risk-tag-${row.risk.label.toLowerCase().replace(/\s+/g, "-")}`}
                    >
                      {row.risk.label}
                    </span>
                  </td>
                  <td>{row.cardMeta.expectedTimeToResults}</td>
                  <td>
                    <span className={`exec-advisor-status exec-advisor-status-${row.status.toLowerCase()}`}>
                      {row.status}
                    </span>
                  </td>
                </tr>
                {expandedId === row.id && (
                  <tr className="exec-advisor-table-reasons-row">
                    <td colSpan={8}>
                      <div className="exec-advisor-row-detail">
                        <p className="exec-advisor-risk-explain">{row.risk.explanation}</p>

                        <div className="exec-advisor-why-grid compact">
                          <div>
                            <span className="muted">Current situation</span>
                            <p>{row.whyThisMatters.currentSituation}</p>
                          </div>
                          <div>
                            <span className="muted">Recommended change</span>
                            <p>{row.whyThisMatters.recommendedChange}</p>
                          </div>
                          <div>
                            <span className="muted">Business impact</span>
                            <p>{row.whyThisMatters.businessImpact}</p>
                          </div>
                        </div>

                        <RecommendationWhyPanel explanation={row.cardMeta.explanation} compact />

                        <div className="exec-advisor-inaction compact">
                          <p className="exec-advisor-inaction-label">Cost of inaction</p>
                          <ExecutiveImpactTimeline timeline={row.inactionCost.timeline} compact />
                        </div>

                        <ExecutiveAskAiPanel
                          title={row.opportunity}
                          recommendationId={row.recommendationId}
                          decisionId={row.decisionId}
                          compact
                        />

                        {(() => {
                          const history = recommendationHistories.find(
                            (h) => h.recommendationId === row.id,
                          );
                          return history ? (
                            <ExecutiveRecommendationHistory history={history} compact />
                          ) : null;
                        })()}

                        <RecommendationActionButtons
                          payload={{
                            decisionId: row.decisionId,
                            recommendationId: row.recommendationId,
                            opportunityKey: row.opportunityKey,
                            title: row.opportunity,
                            confidencePct: row.confidencePct,
                          }}
                          buttons={row.contextualActions}
                          compact
                        />

                        {(row.decisionId || row.recommendationId) && (
                          <Link
                            href={row.decisionId ? `/decisions#${row.decisionId}` : "/decisions"}
                            className="exec-advisor-table-link"
                          >
                            Review in Decisions →
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
