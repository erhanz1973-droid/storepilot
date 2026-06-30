"use client";

import { useCallback, useEffect, useState } from "react";
import type { ProviderValidationResult } from "@/lib/validation/framework/types";
import { ValidationScoreTrend } from "@/components/validation/ValidationScoreTrend";
import { ValidationComparisonTable } from "@/components/validation/ValidationComparisonTable";
import { ValidationSnapshotCard } from "@/components/validation/ValidationSnapshotCard";
import { ProviderReadinessPanel } from "@/components/recommendations/RecommendationEvidencePanel";

type Props = {
  devOnly?: boolean;
  provider?: "meta";
};

function formatTs(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

function StatusDot({ passed }: { passed: boolean }) {
  return (
    <span style={{ color: passed ? "#22c55e" : "#ef4444", marginRight: 6 }}>
      {passed ? "✅" : "❌"}
    </span>
  );
}

function scoreColor(status: string): string {
  if (status === "green") return "#22c55e";
  if (status === "yellow") return "#eab308";
  return "#ef4444";
}

export function MetaValidationPanel({ devOnly = true, provider = "meta" }: Props) {
  const [data, setData] = useState<ProviderValidationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apiBase = `/api/validation/${provider}`;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(apiBase, { cache: "no-store" });
      if (res.status === 404) {
        setData(null);
        return;
      }
      if (!res.ok) throw new Error(await res.text());
      const json = (await res.json()) as ProviderValidationResult;
      setData(json.enabled ? json : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load validation");
    } finally {
      setLoading(false);
    }
  }, [apiBase]);

  useEffect(() => {
    if (devOnly && process.env.NODE_ENV === "production") return;
    void load();
  }, [devOnly, load]);

  const runValidation = async () => {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch(apiBase, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runFresh: true }),
      });
      if (!res.ok) throw new Error(await res.text());
      const json = (await res.json()) as ProviderValidationResult;
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Validation failed");
    } finally {
      setRunning(false);
    }
  };

  const clearCache = async () => {
    setRunning(true);
    try {
      const res = await fetch(apiBase, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      const json = (await res.json()) as ProviderValidationResult;
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Clear cache failed");
    } finally {
      setRunning(false);
    }
  };

  const exportReport = (format: "json" | "html") => {
    window.open(`${apiBase}/export?format=${format}`, "_blank");
  };

  if (devOnly && process.env.NODE_ENV === "production") return null;
  if (loading && !data) {
    return (
      <div className="card" style={{ marginTop: 16, border: "1px dashed #6366f1" }}>
        <p className="muted">Loading validation panel…</p>
      </div>
    );
  }
  if (!data) return null;

  const { connection, syncLogs, apiLogs, cache, comparisons, healthChecks, matchScore } = data;

  return (
    <div className="card" style={{ marginTop: 16, border: "1px dashed #6366f1" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h3 style={{ margin: 0 }}>Validation Framework — {data.providerLabel}</h3>
          <p className="muted" style={{ margin: "4px 0 0", fontSize: "0.85rem" }}>
            Enterprise data accuracy verification (dev only)
          </p>
        </div>
        <div className="actions-row" style={{ flexWrap: "wrap" }}>
          <button type="button" className="btn btn-secondary" onClick={() => void runValidation()} disabled={running}>
            {running ? "Running…" : "Run Validation"}
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => void clearCache()} disabled={running}>
            Clear Cache
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => exportReport("json")}>
            Export JSON
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => exportReport("html")}>
            Export Report
          </button>
        </div>
      </div>

      {error && (
        <p style={{ color: "#ef4444", marginTop: 12, fontSize: "0.9rem" }}>{error}</p>
      )}

      <section
        style={{
          marginTop: 20,
          padding: 16,
          borderRadius: 12,
          background: "rgba(99,102,241,0.06)",
          border: `1px solid ${scoreColor(matchScore.status)}33`,
        }}
      >
        <p className="muted" style={{ margin: 0, fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Validation Score
        </p>
        <p style={{ margin: "8px 0 0", fontSize: "1.5rem", fontWeight: 700, color: scoreColor(matchScore.status) }}>
          {matchScore.emoji} {matchScore.label}
        </p>
        <p className="muted" style={{ margin: "4px 0 0", fontSize: "0.85rem" }}>
          {matchScore.passedMetrics}/{matchScore.totalMetrics} metrics passed · Duration {(data.durationMs / 1000).toFixed(1)}s
        </p>
        {data.trendScores.length > 1 && (
          <div style={{ marginTop: 12 }}>
            <ValidationScoreTrend scores={data.trendScores} />
          </div>
        )}
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16, marginTop: 20 }}>
        <ValidationSnapshotCard title="Dashboard" snapshot={data.dashboardSnapshot} />
        <ValidationSnapshotCard title="Meta Graph API" snapshot={data.apiSnapshot} />
      </div>

      <section style={{ marginTop: 20 }}>
        <h4 style={{ margin: "0 0 8px" }}>Automatic Comparison</h4>
        <ValidationComparisonTable rows={comparisons} />
      </section>

      <section style={{ marginTop: 20 }}>
        <h4 style={{ margin: "0 0 8px" }}>Connection</h4>
        <div className="stack">
          {[
            ["Business Name", connection.businessName],
            ["Business ID", connection.businessId],
            ["Ad Account Name", connection.accountName],
            ["Ad Account ID", connection.accountId],
            ["Connection Status", connection.connectionStatus],
            ["Access Token Expiration", formatTs(connection.tokenExpiresAt)],
            ["Last Sync Time", formatTs(connection.lastSyncAt)],
            ["API Version", connection.apiVersion],
            ["Timezone", connection.timezone],
          ].map(([label, value]) => (
            <div key={String(label)} className="breakdown-row">
              <span>{label}</span>
              <strong>{value ?? "—"}</strong>
            </div>
          ))}
        </div>
      </section>

      {"integrationGate" in data && data.integrationGate && (
        <ProviderReadinessPanel gate={data.integrationGate} />
      )}

      <section style={{ marginTop: 20 }}>
        <h4 style={{ margin: "0 0 8px" }}>Health Checks</h4>
        <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none" }}>
          {healthChecks.map((check) => (
            <li key={check.id} style={{ marginBottom: 6, fontSize: "0.9rem" }}>
              <StatusDot passed={check.passed} />
              {check.label}
              {check.detail ? <span className="muted"> — {check.detail}</span> : null}
            </li>
          ))}
        </ul>
      </section>

      <section style={{ marginTop: 20 }}>
        <h4 style={{ margin: "0 0 8px" }}>Validation History</h4>
        {data.history.length === 0 ? (
          <p className="muted" style={{ fontSize: "0.85rem" }}>No runs yet. Click Run Validation.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", fontSize: "0.8rem", borderCollapse: "collapse" }}>
              <thead>
                <tr className="muted">
                  <th style={{ textAlign: "left", padding: 4 }}>Time</th>
                  <th style={{ textAlign: "left", padding: 4 }}>User</th>
                  <th style={{ textAlign: "left", padding: 4 }}>Business</th>
                  <th style={{ textAlign: "left", padding: 4 }}>Account</th>
                  <th style={{ textAlign: "right", padding: 4 }}>Score</th>
                  <th style={{ textAlign: "right", padding: 4 }}>Pass</th>
                  <th style={{ textAlign: "right", padding: 4 }}>Fail</th>
                  <th style={{ textAlign: "right", padding: 4 }}>Duration</th>
                </tr>
              </thead>
              <tbody>
                {data.history.slice(0, 20).map((entry) => (
                  <tr key={entry.id}>
                    <td style={{ padding: 4 }}>{formatTs(entry.timestamp)}</td>
                    <td style={{ padding: 4 }}>{entry.user}</td>
                    <td style={{ padding: 4 }}>{entry.businessName ?? "—"}</td>
                    <td style={{ padding: 4 }}>{entry.accountId ?? "—"}</td>
                    <td style={{ padding: 4, textAlign: "right", fontWeight: 600 }}>{entry.matchScore}%</td>
                    <td style={{ padding: 4, textAlign: "right", color: "#22c55e" }}>{entry.passedChecks}</td>
                    <td style={{ padding: 4, textAlign: "right", color: "#ef4444" }}>{entry.failedChecks}</td>
                    <td style={{ padding: 4, textAlign: "right" }}>{(entry.durationMs / 1000).toFixed(1)}s</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section style={{ marginTop: 20 }}>
        <h4 style={{ margin: "0 0 8px" }}>Cache Debug</h4>
        <div className="stack">
          {[
            ["Cache Key", cache.cacheKey],
            ["Created At", formatTs(cache.createdAt)],
            ["Expires At", cache.expiresAt ? formatTs(cache.expiresAt) : "Until next sync"],
            ["Last Hit", formatTs(cache.lastHitAt)],
            ["Last Miss", formatTs(cache.lastMissAt)],
            ["Hit / Miss", `${cache.hitCount} / ${cache.missCount}`],
          ].map(([label, value]) => (
            <div key={String(label)} className="breakdown-row">
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
      </section>

      <section style={{ marginTop: 20 }}>
        <h4 style={{ margin: "0 0 8px" }}>Sync Log (last 20)</h4>
        {syncLogs.length === 0 ? (
          <p className="muted" style={{ fontSize: "0.85rem" }}>No sync logs yet.</p>
        ) : (
          <div className="stack" style={{ gap: 12 }}>
            {syncLogs.map((log) => (
              <pre
                key={log.id}
                style={{
                  margin: 0,
                  padding: 12,
                  background: log.level === "success" ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)",
                  borderRadius: 8,
                  fontSize: "0.75rem",
                  overflow: "auto",
                  whiteSpace: "pre-wrap",
                }}
              >
                {log.message}
              </pre>
            ))}
          </div>
        )}
      </section>

      <section style={{ marginTop: 20 }}>
        <h4 style={{ margin: "0 0 8px" }}>API Verification Log</h4>
        {apiLogs.length === 0 ? (
          <p className="muted" style={{ fontSize: "0.85rem" }}>No API calls logged yet.</p>
        ) : (
          <div style={{ maxHeight: 240, overflow: "auto", fontSize: "0.8rem" }}>
            {apiLogs.slice(0, 20).map((log) => (
              <div key={log.id} className="breakdown-row" style={{ marginBottom: 4 }}>
                <span className="muted">{formatTs(log.timestamp)}</span>
                <code>
                  {log.method} {log.endpoint}
                  {log.dateRange ? ` · ${log.dateRange}` : ""}
                  {log.context ? ` · ${log.context}` : ""}
                </code>
              </div>
            ))}
          </div>
        )}
        {data.lastValidatedAt && (
          <p className="muted" style={{ marginTop: 8, fontSize: "0.8rem" }}>
            Last validated: {formatTs(data.lastValidatedAt)}
          </p>
        )}
      </section>
    </div>
  );
}
