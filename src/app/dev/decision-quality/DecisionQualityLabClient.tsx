"use client";

import { useCallback, useEffect, useState } from "react";
import type { EnrichedQualityRunResult, QualityLabReport, QualityRunSummary } from "@/lib/decision-quality-lab/types";
import type { BusinessModel } from "@/lib/business-model/types";
import { SIMULATION_SCENARIOS } from "@/lib/simulation-lab/scenarios";

function Badge({ verdict }: { verdict: string }) {
  const c =
    verdict === "pass"
      ? { bg: "rgba(34,197,94,0.15)", fg: "#22c55e" }
      : verdict === "warn"
        ? { bg: "rgba(234,179,8,0.15)", fg: "#eab308" }
        : { bg: "rgba(239,68,68,0.15)", fg: "#ef4444" };
  return (
    <span style={{ padding: "2px 8px", borderRadius: 6, fontSize: "0.75rem", fontWeight: 600, background: c.bg, color: c.fg }}>
      {verdict.toUpperCase()}
    </span>
  );
}

export function DecisionQualityLabClient() {
  const [scenarioId, setScenarioId] = useState("dead_inventory");
  const [businessModel, setBusinessModel] = useState<BusinessModel>("own_inventory");
  const [loading, setLoading] = useState(false);
  const [lastRun, setLastRun] = useState<QualityRunSummary | null>(null);
  const [lastResult, setLastResult] = useState<EnrichedQualityRunResult | null>(null);
  const [report, setReport] = useState<QualityLabReport | null>(null);
  const [benchmarks, setBenchmarks] = useState<QualityLabReport["benchmark"][]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/dev/decision-quality");
    if (!res.ok) return;
    const data = await res.json();
    setReport(data.report);
    setBenchmarks(data.benchmarks ?? []);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function post(action: string, extra?: Record<string, unknown>) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/dev/decision-quality", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, scenarioId, businessModel, ...extra }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Request failed");
      if (data.result) {
        setLastRun(data.result.summary);
        setLastResult(data.result);
      }
      if (data.report) setReport(data.report);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Decision Quality Lab</h3>
        <p className="muted" style={{ fontSize: "0.9rem" }}>
          Semantic intent evaluation · quality scores · Monte Carlo · replay · drift · release gate
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
          <label>
            <span className="muted" style={{ fontSize: "0.85rem" }}>Scenario</span>
            <select value={scenarioId} onChange={(e) => setScenarioId(e.target.value)} style={{ display: "block", width: "100%", marginTop: 4 }}>
              {SIMULATION_SCENARIOS.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="muted" style={{ fontSize: "0.85rem" }}>Business model</span>
            <select value={businessModel} onChange={(e) => setBusinessModel(e.target.value as BusinessModel)} style={{ display: "block", width: "100%", marginTop: 4 }}>
              {["own_inventory", "dropshipping", "subscription", "print_on_demand", "digital_products", "private_label", "hybrid"].map((m) => (
                <option key={m} value={m}>{m.replace(/_/g, " ")}</option>
              ))}
            </select>
          </label>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <button type="button" disabled={loading} onClick={() => post("run")}>Run evaluation</button>
          <button type="button" disabled={loading} onClick={() => post("regression", { randomStoreCount: 5 })}>Regression</button>
          {[10, 100, 1000].map((n) => (
            <button key={n} type="button" disabled={loading} onClick={() => post("monte_carlo", { randomStoreCount: n })}>
              Monte Carlo ({n})
            </button>
          ))}
          <button type="button" disabled={loading} onClick={() => post("replay", { days: 90 })}>Replay 90d</button>
          <button type="button" disabled={loading} onClick={() => post("approve_baseline")}>Approve baseline</button>
        </div>
        {error && <p style={{ color: "#ef4444" }}>{error}</p>}
      </div>

      {report && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Decision Accuracy</h3>
          <p style={{ fontSize: "1.5rem", margin: "8px 0" }}>
            <strong>{report.accuracyPct}%</strong>{" "}
            <span className="muted" style={{ fontSize: "0.9rem" }}>trend: {report.accuracyTrend}</span>
          </p>
          <p className="muted">Avg quality {report.avgQualityPct}% · {report.totalRuns} runs</p>
          {report.gate && (
            <>
              <p>
                Release gate <Badge verdict={report.gate.passed ? "pass" : "fail"} />
              </p>
              <ul style={{ fontSize: "0.85rem", margin: 0 }}>
                {report.gate.checks.map((c) => (
                  <li key={c.id}>
                    <Badge verdict={c.passed ? "pass" : "fail"} /> {c.label}: {c.actual}% (≥{c.threshold}%)
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {lastResult && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Intent evaluation <Badge verdict={lastResult.verdict} /></h3>
          <table style={{ width: "100%", fontSize: "0.85rem" }}>
            <thead>
              <tr>
                <th align="left">Expected intent</th>
                <th align="left">Actual</th>
                <th align="left">Verdict</th>
                <th align="left">Quality</th>
              </tr>
            </thead>
            <tbody>
              {lastResult.semantic.matches.map((m) => (
                <tr key={m.expectedIntent}>
                  <td>{m.expectedLabel}</td>
                  <td>{m.matchedDecisionSummary ?? (m.actualIntents.join(", ") || "—")}</td>
                  <td><Badge verdict={m.verdict} /></td>
                  <td>{m.qualityScorePct != null ? `${m.qualityScorePct}%` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {lastResult.qualityRecords[0]?.selfAssessment && (
            <p className="muted" style={{ fontSize: "0.85rem", marginTop: 12 }}>
              Self-assessment: {lastResult.qualityRecords[0].selfAssessment.narrative}
            </p>
          )}
        </div>
      )}

      {lastRun && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Latest run</h3>
          <p className="muted">{lastRun.scenarioId} · {lastRun.businessModel}</p>
          <p>
            Accuracy {lastRun.accuracyPct}% · Quality {lastRun.avgQualityPct}% ·
            Confidence {lastRun.avgConfidencePct}% · Compliance {lastRun.businessModelCompliancePct}%
          </p>
          {lastRun.driftFlags.length > 0 && (
            <p style={{ color: "#eab308" }}>Drift: {lastRun.driftFlags.join("; ")}</p>
          )}
        </div>
      )}

      {report?.leaderboard && report.leaderboard.length > 0 && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Decision Leaderboard</h3>
          <table style={{ width: "100%", fontSize: "0.85rem" }}>
            <thead>
              <tr>
                <th align="left">#</th>
                <th align="left">Type</th>
                <th align="left">Quality</th>
                <th align="left">Confidence</th>
                <th align="left">Approval</th>
                <th align="left">Outcome</th>
              </tr>
            </thead>
            <tbody>
              {report.leaderboard.slice(0, 10).map((e) => (
                <tr key={e.intent}>
                  <td>{e.rank}</td>
                  <td>{e.decisionType}</td>
                  <td>{e.avgQualityPct}%</td>
                  <td>{e.avgConfidencePct}%</td>
                  <td>{e.merchantApprovalRatePct}%</td>
                  <td>{e.outcomeSuccessRatePct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {benchmarks.length > 0 && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Release benchmarks</h3>
          <table style={{ width: "100%", fontSize: "0.85rem" }}>
            <thead>
              <tr>
                <th align="left">Version</th>
                <th align="left">Accuracy</th>
                <th align="left">Quality</th>
                <th align="left">PASS</th>
                <th align="left">Gate</th>
              </tr>
            </thead>
            <tbody>
              {benchmarks.slice(0, 8).map((b) => (
                <tr key={b!.releaseVersion}>
                  <td>{b!.releaseVersion}</td>
                  <td>{b!.accuracyPct}%</td>
                  <td>{b!.avgQualityPct}%</td>
                  <td>{b!.passCount}</td>
                  <td><Badge verdict={b!.gatePassed ? "pass" : "fail"} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
