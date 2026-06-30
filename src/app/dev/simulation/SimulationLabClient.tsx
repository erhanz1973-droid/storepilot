"use client";

import { useCallback, useEffect, useState } from "react";
import type { SimulationRunResult, SimulationRegressionReport } from "@/lib/simulation-lab/types";
import type { BusinessModel } from "@/lib/business-model/types";

type ScenarioMeta = {
  id: string;
  label: string;
  description: string;
  defaultBusinessModel: BusinessModel;
  expectedCount: number;
};

const BUSINESS_MODELS: BusinessModel[] = [
  "own_inventory",
  "dropshipping",
  "subscription",
  "print_on_demand",
  "digital_products",
  "hybrid",
];

function VerdictBadge({ verdict }: { verdict: string }) {
  const colors: Record<string, { bg: string; fg: string }> = {
    pass: { bg: "rgba(34,197,94,0.15)", fg: "#22c55e" },
    warn: { bg: "rgba(234,179,8,0.15)", fg: "#eab308" },
    fail: { bg: "rgba(239,68,68,0.15)", fg: "#ef4444" },
  };
  const c = colors[verdict] ?? colors.fail;
  return (
    <span
      style={{
        padding: "2px 8px",
        borderRadius: 6,
        fontSize: "0.75rem",
        fontWeight: 600,
        background: c.bg,
        color: c.fg,
      }}
    >
      {verdict.toUpperCase()}
    </span>
  );
}

export function SimulationLabClient() {
  const [scenarios, setScenarios] = useState<ScenarioMeta[]>([]);
  const [scenarioId, setScenarioId] = useState("dead_inventory");
  const [businessModel, setBusinessModel] = useState<BusinessModel>("own_inventory");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SimulationRunResult | null>(null);
  const [regression, setRegression] = useState<SimulationRegressionReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [custom, setCustom] = useState({
    revenue30d: 15000,
    orders30d: 120,
    metaSpend: 4200,
    googleSpend: 1800,
    roas: 3.8,
    ctr: 2.1,
    creativeFatigue: "high" as "low" | "medium" | "high",
    inventory: 0,
  });

  const loadScenarios = useCallback(async () => {
    const res = await fetch("/api/dev/simulation");
    if (!res.ok) return;
    const data = await res.json();
    setScenarios(data.scenarios ?? []);
    if (data.lastRun) setResult(data.lastRun);
    if (data.lastRegression) setRegression(data.lastRegression);
  }, []);

  useEffect(() => {
    loadScenarios();
  }, [loadScenarios]);

  useEffect(() => {
    const s = scenarios.find((x) => x.id === scenarioId);
    if (s) setBusinessModel(s.defaultBusinessModel);
  }, [scenarioId, scenarios]);

  async function post(action: string, extra?: Record<string, unknown>) {
    setLoading(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        action,
        scenarioId,
        businessModel,
        ...extra,
      };
      if (scenarioId === "custom") {
        body.customInput = { businessModel, ...custom };
      }
      const res = await fetch("/api/dev/simulation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Request failed");
      if (data.result) setResult(data.result);
      if (data.report) setRegression(data.report);
      return data;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Scenario</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <label>
            <span className="muted" style={{ fontSize: "0.85rem" }}>Predefined scenario</span>
            <select
              value={scenarioId}
              onChange={(e) => setScenarioId(e.target.value)}
              style={{ display: "block", width: "100%", marginTop: 4 }}
            >
              {scenarios.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
              <option value="custom">Custom scenario</option>
            </select>
          </label>
          <label>
            <span className="muted" style={{ fontSize: "0.85rem" }}>Business model</span>
            <select
              value={businessModel}
              onChange={(e) => setBusinessModel(e.target.value as BusinessModel)}
              style={{ display: "block", width: "100%", marginTop: 4 }}
            >
              {BUSINESS_MODELS.map((m) => (
                <option key={m} value={m}>
                  {m.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </label>
        </div>

        {scenarioId === "custom" && (
          <div
            style={{
              marginTop: 16,
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 10,
            }}
          >
            {(
              [
                ["revenue30d", "Revenue (30d)"],
                ["orders30d", "Orders"],
                ["metaSpend", "Meta spend (7d)"],
                ["googleSpend", "Google spend (7d)"],
                ["roas", "ROAS"],
                ["ctr", "CTR %"],
                ["inventory", "Inventory"],
              ] as const
            ).map(([key, label]) => (
              <label key={key}>
                <span className="muted" style={{ fontSize: "0.8rem" }}>{label}</span>
                <input
                  type="number"
                  value={custom[key]}
                  onChange={(e) =>
                    setCustom((c) => ({ ...c, [key]: Number(e.target.value) }))
                  }
                  style={{ display: "block", width: "100%", marginTop: 4 }}
                />
              </label>
            ))}
            <label>
              <span className="muted" style={{ fontSize: "0.8rem" }}>Creative fatigue</span>
              <select
                value={custom.creativeFatigue}
                onChange={(e) =>
                  setCustom((c) => ({
                    ...c,
                    creativeFatigue: e.target.value as "low" | "medium" | "high",
                  }))
                }
                style={{ display: "block", width: "100%", marginTop: 4 }}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </label>
          </div>
        )}

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 16 }}>
          <button type="button" disabled={loading} onClick={() => post("generate")}>
            Generate dataset
          </button>
          <button type="button" disabled={loading} onClick={() => post("run")}>
            Run decision engine
          </button>
          <button type="button" disabled={loading} onClick={() => post("validate")}>
            Run validation
          </button>
          <button type="button" disabled={loading} onClick={() => post("regression")}>
            Run regression suite
          </button>
          <button type="button" disabled={loading} onClick={() => post("clear")}>
            Clear dataset
          </button>
          {result && (
            <>
              <a href="/api/dev/simulation?format=json" style={{ alignSelf: "center" }}>
                Export JSON
              </a>
              <a href="/api/dev/simulation?format=csv" style={{ alignSelf: "center" }}>
                Export CSV
              </a>
              <a href="/api/dev/simulation?format=html" style={{ alignSelf: "center" }}>
                Export HTML
              </a>
            </>
          )}
        </div>
        {error && <p style={{ color: "#ef4444", marginBottom: 0 }}>{error}</p>}
      </div>

      {result && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>
            Latest run — {result.scenarioLabel}{" "}
            <VerdictBadge verdict={result.verdict} />
          </h3>
          <p className="muted" style={{ fontSize: "0.85rem" }}>
            Store {result.storeId.slice(0, 8)}… · {result.businessModel} ·{" "}
            {result.decisions.length} decisions · {result.analyzerCount} analyzer outputs
          </p>
          <p style={{ fontSize: "0.9rem" }}>
            Performance: generate {result.performance.generationMs}ms · validation{" "}
            {result.performance.validationMs}ms · engine {result.performance.decisionEngineMs}ms
            {result.performance.withinTargets ? " ✓ targets" : " (over target)"}
          </p>

          <table style={{ width: "100%", fontSize: "0.85rem", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th align="left">Expected</th>
                <th align="left">Actual</th>
                <th align="left">Verdict</th>
                <th align="left">Confidence</th>
                <th align="left">Reason</th>
              </tr>
            </thead>
            <tbody>
              {result.decisionMatches.map((m) => (
                <tr key={m.expectedId}>
                  <td>{m.expectedLabel}</td>
                  <td>{m.actualSummary ?? "—"}</td>
                  <td>
                    <VerdictBadge verdict={m.verdict} />
                  </td>
                  <td>{m.confidencePct != null ? `${m.confidencePct}%` : "—"}</td>
                  <td className="muted">{m.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {result.forbiddenHits.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <strong style={{ color: "#ef4444" }}>Forbidden decisions</strong>
              <ul>
                {result.forbiddenHits.map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {regression && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Regression suite</h3>
          <p>
            {regression.passed} PASS · {regression.warned} WARN · {regression.failed} FAIL ·{" "}
            {regression.totalScenarios} total ({regression.performance.totalMs}ms)
          </p>
          <table style={{ width: "100%", fontSize: "0.85rem", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th align="left">Scenario</th>
                <th align="left">Model</th>
                <th align="left">Verdict</th>
                <th align="left">Engine ms</th>
                <th align="left">Failures</th>
              </tr>
            </thead>
            <tbody>
              {regression.results.map((r) => (
                <tr key={r.runId}>
                  <td>{r.scenarioLabel}</td>
                  <td>{r.businessModel}</td>
                  <td>
                    <VerdictBadge verdict={r.verdict} />
                  </td>
                  <td>{r.performance.decisionEngineMs}</td>
                  <td className="muted">
                    {r.decisionMatches
                      .filter((m) => m.verdict === "fail")
                      .map((m) => m.expectedLabel)
                      .join(", ") || "—"}
                    {r.forbiddenHits[0] ? ` · ${r.forbiddenHits[0]}` : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
