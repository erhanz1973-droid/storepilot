"use client";

import Link from "next/link";
import { Fragment, useMemo, useState } from "react";
import type { RecommendationRow } from "@/lib/analytics/executive-advisor";
import { RecommendationActionButtons } from "@/components/executive/RecommendationActionButtons";
import { ExecutiveImpactTimeline } from "@/components/executive/advisor/ExecutiveImpactTimeline";
import { ExecutiveAskAiPanel } from "@/components/executive/advisor/ExecutiveAskAiPanel";
import { ExecutiveRecommendationHistory } from "@/components/executive/advisor/ExecutiveRecommendationHistory";

type SortKey = "impact" | "confidence" | "time" | "risk";

function fmt(n: number) {
  return `+$${n.toLocaleString()}`;
}

const RISK_ORDER: Record<RecommendationRow["risk"]["label"], number> = {
  "Very Safe": 0,
  "Low Risk": 1,
  "Medium Risk": 2,
  "High Risk": 3,
};

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
      if (sortBy === "confidence") return b.confidencePct - a.confidencePct;
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
              ["confidence", "Confidence"],
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
              <th>Expected Monthly Profit</th>
              <th>Confidence</th>
              <th>Est. Success</th>
              <th>Time Required</th>
              <th>Risk</th>
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
                  </td>
                  <td className="exec-advisor-table-profit">{fmt(row.expectedMonthlyProfit)}</td>
                  <td>{row.confidencePct}%</td>
                  <td>{row.estimatedSuccessPct}%</td>
                  <td>{row.timeRequired}</td>
                  <td>
                    <span
                      className={`exec-advisor-risk-tag exec-advisor-risk-tag-${row.risk.label.toLowerCase().replace(/\s+/g, "-")}`}
                    >
                      {row.risk.label}
                    </span>
                  </td>
                  <td>
                    <span className={`exec-advisor-status exec-advisor-status-${row.status.toLowerCase()}`}>
                      {row.status}
                    </span>
                  </td>
                </tr>
                {expandedId === row.id && (
                  <tr className="exec-advisor-table-reasons-row">
                    <td colSpan={7}>
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

                        <div className="exec-advisor-confidence-block compact">
                          <p className="exec-advisor-confidence-label">
                            Confidence {row.confidencePct}% — Based on:
                          </p>
                          <ul className="exec-advisor-confidence-reasons">
                            {row.confidenceReasons.map((r) => (
                              <li key={r}>{r}</li>
                            ))}
                          </ul>
                          <p className="exec-advisor-success-line">
                            Estimated Success: <strong>{row.estimatedSuccessPct}%</strong>
                            <span className="muted"> — expected business outcome</span>
                          </p>
                        </div>

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
