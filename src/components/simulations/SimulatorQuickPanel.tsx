"use client";

import { useState } from "react";
import type { SimulationType } from "@/lib/ai/what-if-types";
import { SIMULATION_LABELS } from "@/lib/ai/what-if-types";
import { LoadingState } from "@/components/ui/LoadingState";

const QUICK_SCENARIOS: { type: SimulationType; budgetPct?: number; discountPct?: number }[] = [
  { type: "increase_google_budget", budgetPct: 0.2 },
  { type: "increase_meta_budget", budgetPct: 0.2 },
  { type: "apply_discount", discountPct: 0.2 },
];

type SimResult = {
  label: string;
  summary: string;
  expectedMonthlyRevenue: number;
  expectedMonthlyProfit: number;
  confidence: number;
  metrics: { label: string; value: string }[];
};

export function SimulatorQuickPanel() {
  const [loading, setLoading] = useState<string | null>(null);
  const [results, setResults] = useState<SimResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function runScenario(scenario: (typeof QUICK_SCENARIOS)[number]) {
    setLoading(scenario.type);
    setError(null);
    try {
      const res = await fetch("/api/simulations/quick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          simulationType: scenario.type,
          budgetChangePct: scenario.budgetPct,
          priceChangePct: scenario.discountPct,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Simulation failed");
      }
      const data = await res.json();
      const r = data.result as SimResult;
      setResults((prev) => [r, ...prev.filter((x) => x.label !== r.label)].slice(0, 3));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Simulation failed");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="card">
      <h3>Revenue & Profit Simulator</h3>
      <p className="muted" style={{ marginTop: 4, marginBottom: 12, fontSize: "0.875rem" }}>
        Model decisions before you make them — uses historical store performance when available
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        {QUICK_SCENARIOS.map((s) => (
          <button
            key={s.type}
            type="button"
            className="btn btn-secondary"
            disabled={loading != null}
            onClick={() => runScenario(s)}
          >
            {loading === s.type ? "Running…" : SIMULATION_LABELS[s.type]}
          </button>
        ))}
      </div>
      {loading && <LoadingState label="Running simulation…" />}
      {error && (
        <p className="muted" style={{ fontSize: "0.875rem", color: "var(--danger)" }}>
          {error}
        </p>
      )}
      {results.map((r) => (
        <article
          key={r.label}
          style={{ padding: "12px 0", borderTop: "1px solid var(--border)" }}
        >
          <h4 style={{ margin: "0 0 4px", fontSize: "0.95rem" }}>{r.label}</h4>
          <p className="muted" style={{ margin: "0 0 8px", fontSize: "0.875rem" }}>
            {r.summary}
          </p>
          <div style={{ display: "flex", gap: 16, fontSize: "0.875rem", flexWrap: "wrap" }}>
            <span>
              Est. revenue: <strong>+${r.expectedMonthlyRevenue.toLocaleString()}/mo</strong>
            </span>
            <span>
              Est. profit: <strong>+${r.expectedMonthlyProfit.toLocaleString()}/mo</strong>
            </span>
            <span>
              Confidence: <strong>{Math.round(r.confidence * 100)}%</strong>
            </span>
          </div>
        </article>
      ))}
    </div>
  );
}
