"use client";

import type {
  IntegrationHealthDashboard,
  IntegrationHealthDimension,
} from "@/lib/integration-health/types";
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

function DimensionBadge({ dimension }: { dimension: IntegrationHealthDimension }) {
  return (
    <span className={`ih-dimension-badge ih-dimension-${dimension.status}`}>
      {dimension.label}
    </span>
  );
}

function DimensionRow({
  title,
  question,
  dimension,
}: {
  title: string;
  question: string;
  dimension: IntegrationHealthDimension;
}) {
  return (
    <div className={`ih-dimension-row ih-dimension-row-${dimension.status}`}>
      <div className="ih-dimension-row-head">
        <div>
          <span className="ih-dimension-title">{title}</span>
          <span className="muted ih-dimension-question">{question}</span>
        </div>
        <DimensionBadge dimension={dimension} />
      </div>
      <p className="ih-dimension-detail">{dimension.detail}</p>
      {dimension.scorePct != null && title !== "Authentication" && (
        <PctBar pct={dimension.scorePct} />
      )}
    </div>
  );
}

function SummaryDimensionCard({
  title,
  question,
  label,
  status,
  value,
}: {
  title: string;
  question: string;
  label: string;
  status: IntegrationHealthDimension["status"];
  value: string;
}) {
  return (
    <div className={`ih-summary-dimension ih-dimension-${status}`}>
      <span className="ih-dimension-title">{title}</span>
      <span className="muted ih-dimension-question">{question}</span>
      <strong className="ih-summary-dimension-value">{value}</strong>
      <span className={`ih-dimension-badge ih-dimension-${status}`}>{label}</span>
    </div>
  );
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
          <p className="ih-eyebrow">Can the AI generate reliable recommendations?</p>
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

      <section className="card ih-summary-dimensions">
        <SummaryDimensionCard
          title="Authentication"
          question="Can StorePilot access the platform?"
          label={systemSummary.authentication.label}
          status={systemSummary.authentication.status}
          value={`${systemSummary.authentication.authorizedCount} / ${systemSummary.authentication.totalProviders}`}
        />
        <SummaryDimensionCard
          title="Data"
          question="Do we have usable information?"
          label={systemSummary.data.label}
          status={systemSummary.data.status}
          value={`${systemSummary.data.qualityPct}% quality`}
        />
        <SummaryDimensionCard
          title="AI Readiness"
          question="Can the AI generate reliable recommendations?"
          label={systemSummary.aiReadiness.label}
          status={systemSummary.aiReadiness.status}
          value={`${systemSummary.aiReadiness.readinessPct}% · ${systemSummary.aiReadiness.featuresAvailable}/${systemSummary.aiReadiness.totalFeatures} features`}
        />
        <div className="ih-summary-dimension ih-dimension-neutral">
          <span className="ih-dimension-title">Last validation</span>
          <span className="muted ih-dimension-question">Most recent health check</span>
          <strong className="ih-summary-dimension-value">
            {relativeValidationTime(systemSummary.lastValidationAt)}
          </strong>
        </div>
      </section>

      <section className="card">
        <div className="ih-section-head">
          <div>
            <h3>Integration Status</h3>
            <p className="muted" style={{ margin: "4px 0 0", fontSize: "0.875rem" }}>
              Each provider shows authentication, data, and AI readiness separately — never mixed
              in one label.
            </p>
          </div>
          <button type="button" className="btn btn-primary" disabled={running} onClick={() => void runTests()}>
            {running ? "Running tests…" : "Run Validation Suite"}
          </button>
        </div>
        <div className="ih-provider-grid">
          {dashboard.providers.map((p) => (
            <article key={p.id} className="ih-provider-card">
              <header>
                <h4>{p.label}</h4>
              </header>
              <div className="ih-provider-dimensions">
                <DimensionRow
                  title="Authentication"
                  question="Can StorePilot access the platform?"
                  dimension={p.authentication}
                />
                <DimensionRow
                  title="Data"
                  question="Do we have usable information?"
                  dimension={p.dataAvailability}
                />
                <DimensionRow
                  title="AI Readiness"
                  question="Can the AI generate reliable recommendations?"
                  dimension={p.aiReadiness}
                />
              </div>
              {p.lastApiError && <p className="ih-error">{p.lastApiError}</p>}
              <details className="ih-entity-details">
                <summary className="muted">Synced datasets</summary>
                <ul className="ih-entity-list">
                  {p.entityChecks.map((e) => (
                    <li key={e.label}>
                      <span>{e.label}</span>
                      <span>{e.value}</span>
                      <span className={`ih-entity-${e.status}`}>{e.status}</span>
                    </li>
                  ))}
                </ul>
              </details>
            </article>
          ))}
        </div>
      </section>

      <section className="card">
        <h3>AI Readiness by Module</h3>
        <p className="muted" style={{ margin: "0 0 12px", fontSize: "0.875rem" }}>
          Module-level view of whether AI features have enough data to run reliably.
        </p>
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
          <h3>Data Quality Issues</h3>
          <p className="muted" style={{ margin: "0 0 12px", fontSize: "0.875rem" }}>
            Gaps in usable information — separate from authentication status.
          </p>
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
          <h3>Sync Monitoring</h3>
          <p className="muted" style={{ margin: "0 0 12px", fontSize: "0.875rem" }}>
            When data last flowed — authentication can be valid while sync is stale.
          </p>
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
        Business performance lives on <Link href="/health">Health</Link>. This page covers
        authentication access, data availability, and AI readiness only.
      </p>
    </div>
  );
}
