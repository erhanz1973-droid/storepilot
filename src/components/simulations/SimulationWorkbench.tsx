"use client";

import { MetricPills } from "@/components/MetricPills";
import {
  SIMULATION_LABELS,
  type SimulationType,
  type WhatIfSimulationResult,
} from "@/lib/ai/what-if-types";
import { useCallback, useEffect, useState } from "react";

type Props = {
  recommendationId?: string;
  opportunityId?: string;
  onClose: () => void;
};

function formatMoney(n: number): string {
  return n.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function ScenarioCard({
  result,
  selected,
  onToggle,
}: {
  result: WhatIfSimulationResult;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className={`simulation-scenario-card ${selected ? "selected" : ""}`}
      onClick={onToggle}
    >
      <div className="simulation-scenario-header">
        <strong>{result.label}</strong>
        <span className={`basis-badge basis-${result.basis}`}>
          {result.basis === "measured_historical" ? "Historical blend" : "Prediction"}
        </span>
      </div>
      <div className="simulation-scenario-metrics">
        <div>
          <span className="muted">Revenue</span>
          <strong>{formatMoney(result.expectedMonthlyRevenue)}/mo</strong>
        </div>
        <div>
          <span className="muted">Profit</span>
          <strong>{formatMoney(result.expectedMonthlyProfit)}/mo</strong>
        </div>
        <div>
          <span className="muted">Confidence</span>
          <strong>{Math.round(result.confidence * 100)}%</strong>
        </div>
        <div>
          <span className="muted">Effort</span>
          <strong>{result.implementationEffort}</strong>
        </div>
      </div>
      <p className="muted" style={{ margin: "8px 0 0", fontSize: "0.85rem", textAlign: "left" }}>
        {result.summary}
      </p>
    </button>
  );
}

export function SimulationWorkbench({
  recommendationId,
  opportunityId,
  onClose,
  embedded = false,
}: Props & { embedded?: boolean }) {
  const [available, setAvailable] = useState<SimulationType[]>([]);
  const [scenarios, setScenarios] = useState<WhatIfSimulationResult[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const query = recommendationId
    ? `recommendationId=${recommendationId}`
    : `opportunityId=${opportunityId}`;

  const loadAvailable = useCallback(async () => {
    const res = await fetch(`/api/simulations?${query}`);
    if (res.ok) {
      const data = (await res.json()) as { available: SimulationType[] };
      setAvailable(data.available);
    }
  }, [query]);

  useEffect(() => {
    loadAvailable().finally(() => setLoading(false));
  }, [loadAvailable]);

  async function runSimulation(type: SimulationType) {
    setRunning(type);
    setError(null);
    try {
      const res = await fetch("/api/simulations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recommendationId,
          opportunityId,
          simulationType: type,
        }),
      });
      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        setError(typeof err.error === "string" ? err.error : "Simulation failed");
        return;
      }
      const data = (await res.json()) as { result: WhatIfSimulationResult };
      setScenarios((prev) => {
        const filtered = prev.filter((s) => s.simulationType !== type);
        return [...filtered, data.result];
      });
      setSelectedIds((prev) => new Set(prev).add(data.result.id));
    } finally {
      setRunning(null);
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const compared = scenarios.filter((s) => selectedIds.has(s.id));

  return (
    <div className={`simulation-workbench ${embedded ? "embedded" : ""}`}>
      <div className="simulation-workbench-header">
        <div>
          <p className="muted" style={{ margin: 0, fontSize: "0.75rem", textTransform: "uppercase" }}>
            AI Simulations — What If
          </p>
          {!embedded && (
            <h4 style={{ margin: "4px 0 0" }}>Compare scenarios before approving</h4>
          )}
        </div>
        {!embedded && (
          <button className="btn btn-ghost" onClick={onClose} type="button">
            Close
          </button>
        )}
      </div>

      <p className="muted simulation-basis-legend">
        <span className="basis-badge basis-prediction">Prediction</span> model-based forecast
        <span className="basis-badge basis-measured_historical">Historical blend</span> adjusted by
        measured outcomes in this category
      </p>

      {loading ? (
        <p className="muted">Loading simulations…</p>
      ) : available.length === 0 ? (
        <p className="muted">No simulations available for this opportunity.</p>
      ) : (
        <div className="simulation-type-grid">
          {available.map((type) => (
            <button
              key={type}
              type="button"
              className="btn btn-ghost simulation-type-btn"
              disabled={running === type}
              onClick={() => runSimulation(type)}
            >
              {running === type ? "…" : `Run: ${SIMULATION_LABELS[type]}`}
            </button>
          ))}
        </div>
      )}

      {error && <p className="error-text">{error}</p>}

      {scenarios.length > 0 && (
        <>
          <h5 style={{ marginTop: 20 }}>Scenarios — select to compare</h5>
          <div className="simulation-scenario-grid">
            {scenarios.map((s) => (
              <ScenarioCard
                key={s.id}
                result={s}
                selected={selectedIds.has(s.id)}
                onToggle={() => toggleSelect(s.id)}
              />
            ))}
          </div>
        </>
      )}

      {compared.length >= 2 && (
        <div className="simulation-compare-table-wrap">
          <h5>Side-by-side comparison ({compared.length})</h5>
          <table className="simulation-compare-table">
            <thead>
              <tr>
                <th>Scenario</th>
                <th>Basis</th>
                <th>Revenue / mo</th>
                <th>Profit / mo</th>
                <th>Confidence</th>
                <th>Effort</th>
              </tr>
            </thead>
            <tbody>
              {compared.map((s) => (
                <tr key={s.id}>
                  <td>{s.label}</td>
                  <td>
                    <span className={`basis-badge basis-${s.basis}`}>
                      {s.basis === "measured_historical" ? "Historical" : "Prediction"}
                    </span>
                  </td>
                  <td>{formatMoney(s.expectedMonthlyRevenue)}</td>
                  <td>{formatMoney(s.expectedMonthlyProfit)}</td>
                  <td>{Math.round(s.confidence * 100)}%</td>
                  <td>{s.implementationEffort}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {compared.length === 1 && (
        <div className="simulation-detail">
          <h5>Scenario detail</h5>
          <p>{compared[0].summary}</p>
          <p className="muted" style={{ fontSize: "0.875rem" }}>
            {compared[0].basisNote}
          </p>
          <MetricPills metrics={compared[0].metrics} />
          <ul className="explain-risks">
            {compared[0].risks.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
