import { buildDecisionQaReport } from "@/lib/services/decision-qa-report";
import { notFound } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

function StatusBadge({ passed }: { passed: boolean }) {
  return (
    <span
      style={{
        padding: "2px 8px",
        borderRadius: 6,
        fontSize: "0.75rem",
        fontWeight: 600,
        background: passed ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
        color: passed ? "#22c55e" : "#ef4444",
      }}
    >
      {passed ? "PASS" : "FAIL"}
    </span>
  );
}

function ReadinessBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    ready: "#22c55e",
    needs_testing: "#eab308",
    incomplete: "#ef4444",
  };
  return (
    <span style={{ color: colors[status] ?? "#94a3b8", fontWeight: 600, textTransform: "capitalize" }}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

export default async function DecisionEngineDevPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  const report = await buildDecisionQaReport();

  return (
    <>
      <div className="page-header">
        <h2>Decision Engine QA</h2>
        <p>
          Internal developer dashboard — {report.decisions.length} decisions generated,{" "}
          {report.merchantReady.length} merchant-ready.{" "}
          <Link href="/decisions">Merchant view</Link>
          {" · "}
          <Link href="/dev/simulation">Simulation Lab</Link>
          {" · "}
          <Link href="/dev/decision-quality">Decision Quality Lab</Link>
          {" · "}
          <Link href="/integration-health">Integration Health</Link>
        </p>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Performance</h3>
        <p style={{ margin: "4px 0" }}>
          Total: <strong>{report.performance.totalMs}ms</strong> / target{" "}
          {report.performance.targetMs}ms{" "}
          <StatusBadge passed={report.performance.withinTarget} />
        </p>
        <p className="muted" style={{ fontSize: "0.85rem", margin: 0 }}>
          Engine {report.performance.decisionCenterMs}ms · QA {report.performance.qaMs}ms
          {report.performance.validationMs != null &&
            ` · Validation ${report.performance.validationMs}ms`}
          {report.performance.strategySimulationMs != null &&
            ` · Strategy sim ${report.performance.strategySimulationMs}ms`}
        </p>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>
          Consistency <StatusBadge passed={report.consistencyPassed} />
        </h3>
        <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none" }}>
          {report.consistency.map((c) => (
            <li key={c.id} style={{ marginBottom: 8, fontSize: "0.9rem" }}>
              <StatusBadge passed={c.passed} /> {c.label}
              {c.detail && (
                <span className="muted" style={{ marginLeft: 8 }}>
                  {c.detail}
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>
          Production checklist <StatusBadge passed={report.productionPassed} />
        </h3>
        <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none" }}>
          {report.production.map((c) => (
            <li key={c.id} style={{ marginBottom: 6, fontSize: "0.88rem" }}>
              <StatusBadge passed={c.passed} /> {c.label}
            </li>
          ))}
        </ul>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Scenario tests</h3>
        <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none" }}>
          {(report.scenarioResults ?? []).map((s) => (
            <li key={s.scenarioId} style={{ marginBottom: 8, fontSize: "0.88rem" }}>
              <StatusBadge passed={s.passed} /> <strong>{s.label}</strong> — {s.actual}{" "}
              <span className="muted">(expected {s.expected})</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Beta readiness</h3>
        <table style={{ width: "100%", fontSize: "0.88rem", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: "6px 0" }}>Component</th>
              <th style={{ textAlign: "left" }}>Status</th>
              <th style={{ textAlign: "left" }}>Notes</th>
            </tr>
          </thead>
          <tbody>
            {report.betaReadiness.map((item) => (
              <tr key={item.component}>
                <td style={{ padding: "8px 0" }}>{item.component}</td>
                <td>
                  <ReadinessBadge status={item.status} />
                </td>
                <td className="muted">{item.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3>All decisions ({report.decisions.length})</h3>
      <div className="stack">
        {report.decisions.map((d) => (
          <article key={d.id} className="card" style={{ fontSize: "0.88rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div>
                <strong>{d.summary}</strong>
                <p className="muted" style={{ margin: "4px 0 0" }}>
                  ID {d.id} · Problem {d.problemKey}
                </p>
              </div>
              <div style={{ textAlign: "right" }}>
                <span
                  style={{
                    padding: "2px 8px",
                    borderRadius: 6,
                    background:
                      d.completenessStatus === "complete"
                        ? "rgba(34,197,94,0.12)"
                        : "rgba(239,68,68,0.12)",
                  }}
                >
                  {d.completenessStatus === "complete" ? "Complete" : "Incomplete"}
                </span>
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                gap: 10,
                margin: "12px 0",
              }}
            >
              <div>
                <span className="muted">Strategy</span>
                <div>{d.recommendedAction}</div>
              </div>
              <div>
                <span className="muted">Confidence</span>
                <div>{d.confidencePct}%</div>
              </div>
              <div>
                <span className="muted">Validation</span>
                <div>{d.validationScorePct ?? "—"}%</div>
              </div>
              <div>
                <span className="muted">Explainability</span>
                <div>{d.explainability?.scorePct ?? "—"}%</div>
              </div>
              <div>
                <span className="muted">Quality</span>
                <div>{d.qualityScorePct}%</div>
              </div>
              <div>
                <span className="muted">Mode</span>
                <div>{d.merchantMode ?? "—"}</div>
              </div>
              <div>
                <span className="muted">Execution</span>
                <div>{d.executionAvailability}</div>
              </div>
              <div>
                <span className="muted">Status</span>
                <div>{d.status}</div>
              </div>
              <div>
                <span className="muted">Observation</span>
                <div>{d.outcome?.measureStatus ?? "—"}</div>
              </div>
            </div>

            {d.alternativeStrategies.length > 0 && (
              <p style={{ margin: "8px 0" }}>
                <span className="muted">Alternatives: </span>
                {d.alternativeStrategies.join(" · ")}
              </p>
            )}

            <p style={{ margin: "8px 0" }}>
              <span className="muted">Providers: </span>
              {d.providerSources.join(", ") || "—"}
            </p>

            <details style={{ marginTop: 8 }}>
              <summary style={{ cursor: "pointer" }}>Completeness checks</summary>
              <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
                {d.completenessChecks.map((c) => (
                  <li key={c.field}>
                    {c.passed ? "✓" : "✗"} {c.label}
                    {c.detail ? ` — ${c.detail}` : ""}
                  </li>
                ))}
              </ul>
            </details>

            <details style={{ marginTop: 8 }}>
              <summary style={{ cursor: "pointer" }}>Decision trace</summary>
              <ol style={{ margin: "8px 0 0", paddingLeft: 18 }}>
                {d.trace.map((step) => (
                  <li key={step.stage} style={{ marginBottom: 4 }}>
                    <strong>{step.label}</strong>
                    {step.detail ? ` — ${step.detail}` : ""}
                  </li>
                ))}
              </ol>
            </details>
          </article>
        ))}
      </div>
    </>
  );
}
