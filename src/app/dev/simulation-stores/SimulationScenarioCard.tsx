"use client";

import { useState } from "react";
import type { SimulationStoreRow } from "@/lib/simulation-stores/types";
import type { SimulationExecutiveSummary } from "@/lib/simulation-stores/executive-summary-types";
import { getScenarioNarrative } from "@/lib/simulation-stores/scenario-narratives";
import { SimulationBadge } from "@/components/simulation/SimulationBadge";
import { SimulationDataSource } from "@/components/simulation/SimulationDataSource";
import { SimulationScenarioBrief } from "@/components/simulation/SimulationScenarioBrief";
import { SimulationOverflowMenu } from "./SimulationOverflowMenu";

const TIME_SIMULATION_OPTIONS = [
  { days: 1, label: "Simulate Next Day" },
  { days: 7, label: "Simulate Next Week" },
  { days: 30, label: "Simulate Next Month" },
  { days: 90, label: "Simulate Next Quarter" },
] as const;

function formatMoney(n: number | null | undefined): string {
  if (n == null || n <= 0) return "—";
  return n.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function healthColor(score: number | null): string {
  if (score == null) return "var(--muted)";
  if (score >= 75) return "#22c55e";
  if (score >= 55) return "#eab308";
  return "#ef4444";
}

type Props = {
  store: SimulationStoreRow;
  summary: SimulationExecutiveSummary | null;
  loading: boolean;
  showDeveloperTools: boolean;
  onViewAnalysis: () => void;
  onOpenDashboard: () => void;
  onAdvanceTime: (days: number) => void;
  onAudit: () => void;
  onReset: () => void;
  onDeleteData: () => void;
  onExport: () => void;
};

export function SimulationScenarioCard({
  store,
  summary,
  loading,
  showDeveloperTools,
  onViewAnalysis,
  onOpenDashboard,
  onAdvanceTime,
  onAudit,
  onReset,
  onDeleteData,
  onExport,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [briefExpanded, setBriefExpanded] = useState(false);
  const narrative = getScenarioNarrative(store.scenarioId, store.label);
  const tagline = narrative.paragraphs[narrative.paragraphs.length - 1] ?? narrative.purpose;
  const hasData = Boolean(store.generatedAt);
  const score = summary?.healthScore ?? null;
  const topRec =
    summary?.topRecommendationTitle ??
    summary?.topRecommendations[0]?.title ??
    null;
  const financialImpact = summary
    ? summary.estimatedMonthlyRecovery > 0
      ? summary.estimatedMonthlyRecovery
      : summary.estimatedMonthlyLoss
    : null;
  const financialLabel = summary?.estimatedMonthlyRecovery
    ? "Est. recovery"
    : "Est. impact";
  const confidence = summary?.confidencePct ?? null;
  const summaryLine = summary?.headline ?? null;

  return (
    <article className="sim-scenario-card">
      <div className="sim-scenario-card-top">
        <SimulationBadge variant="compact" />
      </div>

      <div className="sim-scenario-card-header">
        <div>
          <h3 className="sim-scenario-title">{store.label}</h3>
          <p className="sim-scenario-description">{tagline}</p>
        </div>
        {showDeveloperTools ? (
          <div className="sim-scenario-overflow-wrap">
            <button
              type="button"
              className="btn sim-overflow-trigger"
              aria-label="More actions"
              disabled={loading}
              onClick={() => setMenuOpen((v) => !v)}
            >
              ⋯
            </button>
            <SimulationOverflowMenu
              open={menuOpen}
              onClose={() => setMenuOpen(false)}
              onAudit={() => {
                setMenuOpen(false);
                onAudit();
              }}
              onReset={() => {
                setMenuOpen(false);
                onReset();
              }}
              onDeleteData={() => {
                setMenuOpen(false);
                onDeleteData();
              }}
              onExport={() => {
                setMenuOpen(false);
                onExport();
              }}
              disabled={loading}
            />
          </div>
        ) : null}
      </div>

      <div className="sim-scenario-brief-toggle-wrap">
        <button
          type="button"
          className="sim-scenario-brief-toggle"
          onClick={() => setBriefExpanded((v) => !v)}
        >
          {briefExpanded ? "Hide scenario details" : "Read full scenario"}
        </button>
      </div>

      {briefExpanded ? (
        <>
          <SimulationScenarioBrief narrative={narrative} />
          <SimulationDataSource compact />
        </>
      ) : (
        <SimulationScenarioBrief narrative={narrative} compact />
      )}

      <div className="sim-scenario-metrics">
        <div className="sim-scenario-metric">
          <span className="sim-scenario-metric-label">Store Health</span>
          <strong style={{ color: healthColor(score) }}>{score ?? "—"}</strong>
        </div>
        <div className="sim-scenario-metric sim-scenario-metric-wide">
          <span className="sim-scenario-metric-label">Top Recommendation</span>
          <strong className="sim-scenario-metric-text">{topRec ?? "Run analysis to see"}</strong>
        </div>
        <div className="sim-scenario-metric">
          <span className="sim-scenario-metric-label">{financialLabel}</span>
          <strong>{formatMoney(financialImpact)}</strong>
        </div>
        <div className="sim-scenario-metric">
          <span className="sim-scenario-metric-label">Confidence</span>
          <strong>{confidence != null ? `${confidence}%` : "—"}</strong>
        </div>
      </div>

      {summaryLine ? (
        <p className="sim-scenario-summary-line">
          <span className="sim-ai-result-label">AI analysis (simulated):</span> {summaryLine}
        </p>
      ) : (
        <p className="sim-scenario-summary-line muted">
          {hasData
            ? "View AI analysis to see StorePilot’s executive summary — based on generated scenario data."
            : "Prepare this scenario, then view how StorePilot analyzes synthetic business data."}
        </p>
      )}

      <div className="sim-scenario-actions">
        <button
          type="button"
          className="btn primary"
          disabled={loading}
          onClick={onViewAnalysis}
        >
          {loading ? "Analyzing…" : "View AI Analysis"}
        </button>
        <button
          type="button"
          className="btn"
          disabled={loading || !hasData}
          onClick={onOpenDashboard}
        >
          Open Dashboard
        </button>
      </div>

      <div className="sim-scenario-time">
        <span className="sim-scenario-time-label">Fast-forward this business:</span>
        <div className="sim-scenario-time-buttons">
          {TIME_SIMULATION_OPTIONS.map(({ days, label }) => (
            <button
              key={days}
              type="button"
              className="btn sim-time-btn"
              disabled={loading || !hasData}
              onClick={() => onAdvanceTime(days)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </article>
  );
}
