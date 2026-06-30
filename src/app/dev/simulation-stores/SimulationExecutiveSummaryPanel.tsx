"use client";

import Link from "next/link";
import type { SimulationExecutiveSummary } from "@/lib/simulation-stores/executive-summary-types";
import type { SimulationScenarioId } from "@/lib/simulation-lab/types";
import { getScenarioNarrative } from "@/lib/simulation-stores/scenario-narratives";
import { SimulationBadge } from "@/components/simulation/SimulationBadge";
import { SimulationDataSource } from "@/components/simulation/SimulationDataSource";
import { SimulationScenarioBrief } from "@/components/simulation/SimulationScenarioBrief";

function formatMoney(n: number, signed = false): string {
  const prefix = signed && n > 0 ? "+" : "";
  return `${prefix}${n.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  })}`;
}

function severityColor(severity: string): string {
  if (severity === "critical") return "#ef4444";
  if (severity === "high") return "#f97316";
  if (severity === "medium") return "#eab308";
  return "#6b7280";
}

type Props = {
  summary: SimulationExecutiveSummary;
  onOpenDashboard?: () => void;
};

export function SimulationExecutiveSummaryPanel({ summary, onOpenDashboard }: Props) {
  const healthColor =
    summary.healthScore >= 75 ? "#22c55e" : summary.healthScore >= 55 ? "#eab308" : "#ef4444";
  const narrative = getScenarioNarrative(
    summary.scenarioId as SimulationScenarioId,
    summary.storeLabel,
  );

  return (
    <div className="card simulation-executive-summary">
      <div className="sim-exec-banner-row">
        <SimulationBadge variant="page" />
        <p className="sim-exec-disclaimer muted">
          All metrics and recommendations below are produced from{" "}
          <strong>simulated scenario data</strong>, not a connected production store.
        </p>
      </div>

      <SimulationScenarioBrief narrative={narrative} />
      <SimulationDataSource />

      <div className="sim-exec-divider" />

      <div className="sim-exec-header">
        <div>
          <p className="sim-exec-eyebrow">AI Executive Summary · Simulated</p>
          <h3 style={{ margin: "4px 0 0" }}>{summary.storeLabel}</h3>
          <p className="muted" style={{ margin: "4px 0 0", fontSize: "0.85rem" }}>
            {summary.scenarioLabel} · {new Date(summary.generatedAt).toLocaleString()}
          </p>
        </div>
        <div className="sim-exec-health" style={{ borderColor: healthColor }}>
          <span className="muted" style={{ fontSize: "0.75rem" }}>
            Health Score
          </span>
          <strong style={{ fontSize: "2rem", color: healthColor, lineHeight: 1.1 }}>
            {summary.healthScore}
          </strong>
          <span style={{ fontSize: "0.8rem", color: healthColor }}>{summary.healthLabel}</span>
        </div>
      </div>

      <p className="sim-exec-headline">{summary.headline}</p>
      <p className="muted" style={{ lineHeight: 1.55, marginBottom: 16 }}>
        {summary.narrative}
      </p>

      <div className="sim-exec-metrics">
        <div className="sim-exec-metric">
          <span className="muted">Critical Issues</span>
          <strong>{summary.criticalIssueCount}</strong>
        </div>
        <div className="sim-exec-metric">
          <span className="muted">Est. Monthly Loss</span>
          <strong style={{ color: "#ef4444" }}>{formatMoney(summary.estimatedMonthlyLoss)}</strong>
        </div>
        <div className="sim-exec-metric">
          <span className="muted">Expected Recovery</span>
          <strong style={{ color: "#22c55e" }}>
            {formatMoney(summary.estimatedMonthlyRecovery, true)}
          </strong>
        </div>
        <div className="sim-exec-metric">
          <span className="muted">AI Confidence</span>
          <strong>{summary.confidencePct}%</strong>
        </div>
      </div>

      {summary.topProblems.length > 0 ? (
        <section className="sim-exec-section">
          <h4>Top Problems <span className="sim-synthetic-tag">simulated</span></h4>
          <ul className="sim-exec-list">
            {summary.topProblems.map((p) => (
              <li key={p.title}>
                <span style={{ color: severityColor(p.severity), fontWeight: 700, fontSize: "0.7rem" }}>
                  {p.severity.toUpperCase()}
                </span>
                <strong>{p.title}</strong>
                <span className="muted">{p.description}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {summary.topRecommendations.length > 0 ? (
        <section className="sim-exec-section">
          <h4>Top Recommendations <span className="sim-synthetic-tag">simulated</span></h4>
          <ul className="sim-exec-list">
            {summary.topRecommendations.map((r) => (
              <li key={r.title}>
                <div className="sim-exec-rec-row">
                  <strong>{r.title}</strong>
                  <span style={{ color: "#22c55e", fontWeight: 700, whiteSpace: "nowrap" }}>
                    {formatMoney(r.expectedMonthlyImpact, true)}/mo
                  </span>
                </div>
                <span className="muted">{r.description}</span>
                <span className="muted" style={{ fontSize: "0.8rem" }}>
                  {r.actionLabel} · {r.confidencePct}% confidence
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="sim-exec-footer">
        {onOpenDashboard ? (
          <button type="button" className="btn" onClick={onOpenDashboard}>
            Open Dashboard
          </button>
        ) : (
          <Link href="/" className="btn">
            Open Dashboard
          </Link>
        )}
        <span className="muted" style={{ fontSize: "0.8rem", alignSelf: "center" }}>
          Simulated revenue 30d: {formatMoney(summary.revenue30d)}
          {summary.blendedRoas != null ? ` · ROAS ${summary.blendedRoas.toFixed(2)}` : ""}
        </span>
      </div>
    </div>
  );
}
