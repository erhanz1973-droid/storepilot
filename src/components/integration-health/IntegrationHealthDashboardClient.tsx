"use client";

import type { IntegrationHealthDashboard } from "@/lib/integration-health/types";
import { relativeValidationTime } from "@/lib/integration-health/trust-summary";
import Link from "next/link";
import { useCallback, useState } from "react";

function StatusIcon({ ok }: { ok: boolean }) {
  return <span className={ok ? "ih-status-ok" : "ih-status-bad"}>{ok ? "✔" : "✕"}</span>;
}

function PctBar({ pct }: { pct: number }) {
  return (
    <div className="ih-pct-bar">
      <div className="ih-pct-fill" style={{ width: `${Math.min(100, pct)}%` }} />
      <span>{pct}%</span>
    </div>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  return <span className={`ih-severity ih-severity-${severity}`}>{severity}</span>;
}

function connectionLabel(p: IntegrationHealthDashboard["providers"][0]): string {
  if (!p.tokenValid && p.connectionStatus !== "disconnected" && p.connectionStatus !== "waiting") {
    return "Token expired";
  }
  if (p.connectionStatus === "error") return "Sync failed";
  if (p.connectionStatus === "connected") return "Connected";
  if (p.connectionStatus === "demo") return "Demo";
  if (p.connectionStatus === "waiting") return "Sync running";
  return "Disconnected";
}

export function IntegrationHealthDashboardClient({
  initial,
}: {
  initial: IntegrationHealthDashboard;
}) {
  const [dashboard, setDashboard] = useState(initial);
  const [running, setRunning] = useState(false);
  const { aiTrust, systemSummary } = dashboard;

  const runTests = useCallback(async () => {
    setRunning(true);
    try {
      const res = await fetch("/api/integration-health", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runTests: true }),
      });
      if (res.ok) {
        setDashboard((await res.json()) as IntegrationHealthDashboard);
      }
    } finally {
      setRunning(false);
    }
  }, []);

  return (
    <div className="ih-dashboard">
      <section className="card ih-trust-banner">
        <div>
          <p className="ih-eyebrow">Can the AI trust the available data?</p>
          <h3>AI Trust Score</h3>
          <p>{aiTrust.narrative}</p>
          {aiTrust.confidenceReductions.length > 0 && (
            <>
              <p className="muted" style={{ marginTop: 12, marginBottom: 6 }}>
                Confidence is reduced because:
              </p>
              <ul className="ih-reduction-list">
                {aiTrust.confidenceReductions.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </>
          )}
        </div>
        <div className="ih-overall-score">
          <span className="muted">AI Trust</span>
          <strong>{aiTrust.aiTrustScorePct}%</strong>
        </div>
      </section>

      <section className="card ih-summary-grid">
        <div className="ih-summary-stat">
          <span className="muted">System Status</span>
          <strong className={`ih-sys-${systemSummary.systemStatus}`}>
            {systemSummary.systemStatus}
          </strong>
        </div>
        <div className="ih-summary-stat">
          <span className="muted">Overall AI Readiness</span>
          <strong>{dashboard.overallAiReadinessPct}%</strong>
        </div>
        <div className="ih-summary-stat">
          <span className="muted">Data Quality</span>
          <strong>{systemSummary.dataQualityPct}%</strong>
        </div>
        <div className="ih-summary-stat">
          <span className="muted">Connected Providers</span>
          <strong>
            {systemSummary.connectedProviders} / {systemSummary.totalProviders}
          </strong>
        </div>
        <div className="ih-summary-stat">
          <span className="muted">AI Features Available</span>
          <strong>
            {systemSummary.aiFeaturesAvailable} / {systemSummary.totalAiFeatures}
          </strong>
        </div>
        <div className="ih-summary-stat">
          <span className="muted">Last Validation</span>
          <strong>{relativeValidationTime(systemSummary.lastValidationAt)}</strong>
        </div>
      </section>

      <section className="card">
        <div className="ih-section-head">
          <h3>Connection Status</h3>
          <button type="button" className="btn btn-primary" disabled={running} onClick={() => void runTests()}>
            {running ? "Running tests…" : "Run Validation Suite"}
          </button>
        </div>
        <div className="ih-provider-grid">
          {dashboard.providers.map((p) => (
            <article key={p.id} className="ih-provider-card">
              <header>
                <h4>
                  <StatusIcon ok={p.connectionStatus === "connected" || p.connectionStatus === "demo"} />
                  {p.label}
                </h4>
                <span className="muted ih-connection-label">{connectionLabel(p)}</span>
              </header>
              <dl className="ih-meta-grid">
                <div>
                  <dt>Token</dt>
                  <dd>{p.tokenValid ? "Valid" : "Expired / invalid"}</dd>
                </div>
                <div>
                  <dt>Last sync</dt>
                  <dd>{p.lastSuccessfulSync ? new Date(p.lastSuccessfulSync).toLocaleString() : "—"}</dd>
                </div>
                <div>
                  <dt>Freshness</dt>
                  <dd>{p.dataFreshness}</dd>
                </div>
                <div>
                  <dt>AI ready</dt>
                  <dd>{p.aiReadyPct}%</dd>
                </div>
              </dl>
              {p.lastApiError && <p className="ih-error">{p.lastApiError}</p>}
              <ul className="ih-entity-list">
                {p.entityChecks.map((e) => (
                  <li key={e.label}>
                    <span>{e.label}</span>
                    <span>{e.value}</span>
                    <span className={`ih-entity-${e.status}`}>{e.status}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="card">
        <h3>AI Readiness by Module</h3>
        <ul className="ih-module-list">
          {dashboard.moduleReadiness.map((m) => (
            <li key={m.id}>
              <span>{m.label}</span>
              <PctBar pct={m.readinessPct} />
              <span className={`ih-module-status ih-module-${m.status}`}>{m.status}</span>
            </li>
          ))}
        </ul>
      </section>

      <div className="ih-two-col">
        <section className="card">
          <h3>Data Quality</h3>
          <ul className="ih-issue-list">
            {dashboard.dataQualityIssues.map((i) => (
              <li key={i.id}>
                <SeverityBadge severity={i.severity} />
                <span>{i.message}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="card">
          <h3>Data Freshness</h3>
          <table className="ih-matrix-table">
            <thead>
              <tr>
                <th>Provider</th>
                <th>Last sync</th>
                <th>Next sync</th>
                <th>Failures</th>
              </tr>
            </thead>
            <tbody>
              {dashboard.syncMonitoring.map((row) => (
                <tr key={row.provider}>
                  <td>{row.provider}</td>
                  <td>{row.lastSync ? new Date(row.lastSync).toLocaleString() : "—"}</td>
                  <td>{row.nextScheduledSync ?? "—"}</td>
                  <td>{row.failedSyncCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      <section className="card">
        <h3>Calculation Validation</h3>
        <ul className="ih-test-list">
          {dashboard.aiCapabilityTests.map((t) => (
            <li key={t.id}>
              <StatusIcon ok={t.passed} />
              <div>
                <strong>{t.label}</strong>
                <span className="muted">{t.detail}</span>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {dashboard.missingDataBlocks.length > 0 && (
        <section className="card">
          <h3>Missing Data Intelligence</h3>
          {dashboard.missingDataBlocks.map((b) => (
            <article key={b.module} className="ih-missing-block">
              <h4>{b.headline}</h4>
              <p>{b.explanation}</p>
              <p className="muted">Required:</p>
              <ul>
                {b.required.map((r) => (
                  <li key={r.label}>
                    {r.met ? "✔" : "○"} {r.label}
                  </li>
                ))}
              </ul>
              {b.estimatedSetupMinutes != null && (
                <p className="muted">Estimated setup: less than {b.estimatedSetupMinutes} minutes</p>
              )}
            </article>
          ))}
        </section>
      )}

      {dashboard.testSuite.length > 0 && (
        <section className="card">
          <h3>
            Validation Suite Results
            {dashboard.testSuiteRanAt && (
              <span className="muted ih-ran-at">
                ran {new Date(dashboard.testSuiteRanAt).toLocaleString()}
              </span>
            )}
          </h3>
          <ul className="ih-test-list">
            {dashboard.testSuite.map((t) => (
              <li key={t.id}>
                <StatusIcon ok={t.passed} />
                <div>
                  <strong>{t.label}</strong>
                  {t.detail && <span className="muted">{t.detail}</span>}
                </div>
                <span className="muted">{t.durationMs}ms</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="muted ih-footer-note">
        Business performance lives on <Link href="/health">Health</Link>. This page covers data
        infrastructure, sync status, and AI readiness only.
      </p>
    </div>
  );
}
