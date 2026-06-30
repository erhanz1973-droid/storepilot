import { buildValidationMetrics, runAndCacheValidation } from "@/lib/services/validation-dashboard";
import Link from "next/link";

export const dynamic = "force-dynamic";

function StatusIcon({ ok }: { ok: boolean }) {
  return <span style={{ color: ok ? "var(--success, #16a34a)" : "var(--critical)" }}>{ok ? "✅" : "❌"}</span>;
}

export default async function ValidationPage({
  searchParams,
}: {
  searchParams: Promise<{ run?: string }>;
}) {
  const params = await searchParams;
  const ran = params.run === "1";
  const { report, metrics } = ran
    ? await runAndCacheValidation()
    : { report: null, metrics: await buildValidationMetrics() };

  const go = metrics.goNoGo;

  return (
    <>
      <div className="page-header">
        <h2>Validation Dashboard</h2>
        <p>
          Internal go/no-go metrics for Phase 6A — prove accuracy before public launch.
          {metrics.lastValidationRun && (
            <> Last run {new Date(metrics.lastValidationRun).toLocaleString()}.</>
          )}
        </p>
        <div className="actions-row" style={{ marginTop: 12 }}>
          <Link href="/validation?run=1" className="btn btn-primary">
            Run validation suite
          </Link>
          <Link href="/api/validation?run=1" className="btn btn-secondary">
            JSON report
          </Link>
        </div>
      </div>

      {go && (
        <div
          className="card"
          style={{
            marginBottom: 16,
            borderColor: go.readyForLaunch ? "var(--success, #16a34a)" : "var(--critical)",
          }}
        >
          <h3 style={{ marginTop: 0 }}>
            Go / No-Go {go.readyForLaunch ? "— Ready" : "— Not Ready"}
          </h3>
          <ul style={{ margin: "8px 0", paddingLeft: 20, lineHeight: 1.8 }}>
            <li><StatusIcon ok={go.profitAccurate} /> Profit calculations match manual</li>
            <li><StatusIcon ok={go.roasAccurate} /> ROAS calculations accurate</li>
            <li><StatusIcon ok={go.attributionConfidenceCorrect} /> Attribution confidence correct</li>
            <li><StatusIcon ok={go.aiEvidenceBased} /> AI recommendations evidence-based</li>
            <li><StatusIcon ok={go.performanceAcceptable} /> Performance acceptable at scale</li>
          </ul>
          {go.blockers.length > 0 && (
            <p className="muted" style={{ margin: 0 }}>
              <strong>Blockers:</strong> {go.blockers.join(" · ")}
            </p>
          )}
          <p className="muted" style={{ margin: "12px 0 0", fontSize: "0.875rem" }}>
            Pilot merchant feedback is tracked in Supabase <code>pilot_feedback</code> — see{" "}
            <code>PILOT_PROGRAM.md</code> in the repo.
          </p>
        </div>
      )}

      <div className="grid-2" style={{ marginBottom: 16 }}>
        <div className="card">
          <h3>Platform Health</h3>
          <div className="stack">
            <div className="breakdown-row"><span>Active stores</span><strong>{metrics.activeStores}</strong></div>
            <div className="breakdown-row"><span>Avg sync duration</span><strong>{metrics.avgSyncDurationMs != null ? `${metrics.avgSyncDurationMs}ms` : "—"}</strong></div>
            <div className="breakdown-row"><span>Validation error rate</span><strong>{metrics.apiErrorRatePct}%</strong></div>
          </div>
        </div>
        <div className="card">
          <h3>Recommendation Quality</h3>
          <div className="stack">
            <div className="breakdown-row"><span>Total recommendations</span><strong>{metrics.totalRecommendations}</strong></div>
            <div className="breakdown-row"><span>Measured outcomes</span><strong>{metrics.measuredRecommendations}</strong></div>
            <div className="breakdown-row"><span>Acceptance rate</span><strong>{metrics.acceptanceRatePct}%</strong></div>
            <div className="breakdown-row"><span>Accuracy rate</span><strong>{metrics.accuracyRatePct}%</strong></div>
            <div className="breakdown-row"><span>False positive rate</span><strong>{metrics.falsePositiveRatePct}%</strong></div>
            <div className="breakdown-row"><span>Avg profit generated</span><strong>${metrics.avgProfitGenerated.toLocaleString()}</strong></div>
          </div>
        </div>
        <div className="card">
          <h3>Merchant Feedback</h3>
          <div className="stack">
            <div className="breakdown-row"><span>👍 Helpful</span><strong>{metrics.feedbackHelpful}</strong></div>
            <div className="breakdown-row"><span>👎 Not helpful</span><strong>{metrics.feedbackNotHelpful}</strong></div>
          </div>
        </div>
      </div>

      {report && (
        <>
          <div className="card" style={{ marginBottom: 16 }}>
            <h3>Performance Benchmarks</h3>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Orders</th>
                  <th>Snapshot</th>
                  <th>Profit engine</th>
                  <th>ROAS engine</th>
                  <th>Attribution</th>
                  <th>Memory (est.)</th>
                </tr>
              </thead>
              <tbody>
                {report.performance.map((b) => (
                  <tr key={b.orderCount}>
                    <td>{b.orderCount.toLocaleString()}</td>
                    <td>{b.snapshotTimeMs}ms</td>
                    <td>{b.profitEngineMs}ms</td>
                    <td>{b.roasEngineMs}ms</td>
                    <td>{b.attributionEngineMs}ms</td>
                    <td>{b.memoryEstimateMb} MB</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="muted" style={{ margin: "8px 0 0", fontSize: "0.875rem" }}>
              Suite completed in {report.durationMs}ms — {report.passed} passed, {report.failed} failed, {report.warned} warnings.
            </p>
          </div>

          <div className="card">
            <h3>Validation Checks</h3>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Suite</th>
                  <th>Check</th>
                  <th>Status</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {report.checks.map((c) => (
                  <tr key={c.id}>
                    <td>{c.suite}</td>
                    <td>{c.name}</td>
                    <td>{c.status}</td>
                    <td className="muted" style={{ fontSize: "0.875rem" }}>{c.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {!report && (
        <div className="card">
          <p className="muted" style={{ margin: 0 }}>
            Click <strong>Run validation suite</strong> to execute profit, ROAS, attribution, AI evidence, performance, and integration checks.
          </p>
        </div>
      )}
    </>
  );
}
