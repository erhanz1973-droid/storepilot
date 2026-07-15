"use client";

import { useCallback, useMemo, useState } from "react";
import {
  buildCalculationAudit,
  type CalculationAudit,
  type ExplainedValue,
} from "@/lib/calculations/audit";
import {
  GOLDEN_EXPECTED,
  goldenDecision,
  goldenRawFacts,
} from "@/lib/calculations/golden/campaign-recovery-30d";
import { FORMULA_ENGINE_VERSION } from "@/lib/calculations/version";
import { setVerificationMode, isVerificationMode } from "@/lib/calculations/audit/verification";
import { MetricExplainDrawer } from "@/components/audit/MetricExplainDrawer";

function money(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function InspectExplained({
  label,
  explained,
}: {
  label: string;
  explained?: ExplainedValue;
}) {
  const [open, setOpen] = useState(false);
  if (!explained) return null;
  return (
    <>
      <button type="button" className="btn btn-ghost" onClick={() => setOpen(true)}>
        Explain {label}
      </button>
      <MetricExplainDrawer
        open={open}
        onClose={() => setOpen(false)}
        title={label}
        explained={explained}
      />
    </>
  );
}

export function DecisionInspectorClient() {
  const [decisionId, setDecisionId] = useState("DEC-GOLDEN-2026-000001");
  const [error, setError] = useState<string | null>(null);
  const [audit, setAudit] = useState<CalculationAudit | null>(null);
  const [verification, setVerification] = useState(isVerificationMode());

  const runInspect = useCallback(() => {
    setError(null);
    const id = decisionId.trim();
    if (!id) {
      setError("Enter a Decision ID");
      return;
    }

    // Golden + local inspector: full pipeline without DB.
    // Production persistence of CalculationAudit can plug in here later.
    if (id === goldenDecision().id || id.toUpperCase().includes("GOLDEN")) {
      const next = buildCalculationAudit({
        decision: goldenDecision(),
        rawFacts: goldenRawFacts(),
        lastSyncedAt: "2026-07-14T12:00:00.000Z",
      });
      setAudit(next);
      return;
    }

    setError(
      `No persisted audit for "${id}". Try ${goldenDecision().id} (golden dataset) until audit storage ships.`,
    );
    setAudit(null);
  }, [decisionId]);

  const stages = useMemo(() => audit?.pipeline ?? [], [audit]);

  return (
    <div className="decision-inspector">
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Inspect decision</h3>
        <p className="muted" style={{ fontSize: "0.9rem" }}>
          Formula Engine <strong>v{FORMULA_ENGINE_VERSION}</strong>
          {" · "}
          Golden lock: recovery {money(GOLDEN_EXPECTED.businessRecovery)}, net{" "}
          {money(GOLDEN_EXPECTED.netProfitImpact)}, ROAS {GOLDEN_EXPECTED.blendedRoas}
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <input
            value={decisionId}
            onChange={(e) => setDecisionId(e.target.value)}
            placeholder="DEC-2026-000142"
            style={{ minWidth: 240, flex: 1 }}
            aria-label="Decision ID"
          />
          <button type="button" className="btn btn-primary" onClick={runInspect}>
            Inspect
          </button>
          <label style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={verification}
              onChange={(e) => {
                const on = e.target.checked;
                setVerification(on);
                setVerificationMode(on);
              }}
            />
            Verification Mode
          </label>
        </div>
        {error ? (
          <p style={{ color: "#ef4444", marginBottom: 0, marginTop: 12 }}>{error}</p>
        ) : null}
      </div>

      {audit ? (
        <>
          <div className="card" style={{ marginBottom: 16 }}>
            <h3 style={{ marginTop: 0 }}>
              {audit.decisionId}{" "}
              <span className="muted" style={{ fontSize: "0.85rem" }}>
                fingerprint {audit.decisionImpactFingerprint}
              </span>
            </h3>
            <p style={{ margin: "4px 0" }}>
              Business Recovery <strong>{money(audit.decisionImpact.businessRecovery)}</strong>
              {" · "}
              Net Profit <strong>{money(audit.decisionImpact.netProfitImpact)}</strong>
              {" · "}
              Confidence <strong>{audit.decisionImpact.confidence}%</strong>
            </p>
            {audit.warnings.length > 0 ? (
              <ul style={{ color: "#eab308", marginBottom: 0 }}>
                {audit.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            ) : (
              <p className="muted" style={{ marginBottom: 0 }}>
                No warnings
              </p>
            )}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
              <InspectExplained
                label="Business Recovery"
                explained={audit.explained.businessRecovery}
              />
              <InspectExplained
                label="Net Profit Impact"
                explained={audit.explained.netProfitImpact}
              />
              <InspectExplained label="Store Net Profit" explained={audit.explained.netProfit} />
              <InspectExplained
                label="Ad Savings"
                explained={audit.explained.advertisingSavings}
              />
            </div>
          </div>

          <div className="card">
            <h3 style={{ marginTop: 0 }}>Calculation Trace</h3>
            <ol className="metric-explain-waterfall">
              {stages.map((s, i) => (
                <li key={s.stage} className="metric-explain-step">
                  <div className="metric-explain-step-row">
                    <strong>
                      {i + 1}. {s.label}
                    </strong>
                    <span className="muted">{s.stage}</span>
                  </div>
                  <pre
                    style={{
                      fontSize: "0.75rem",
                      overflow: "auto",
                      maxHeight: 220,
                      background: "var(--surface-2)",
                      padding: 12,
                      borderRadius: 8,
                    }}
                  >
                    {JSON.stringify(s.payload, null, 2)}
                  </pre>
                  {i < stages.length - 1 ? (
                    <span className="metric-explain-arrow" aria-hidden>
                      ↓
                    </span>
                  ) : null}
                </li>
              ))}
            </ol>
          </div>
        </>
      ) : null}
    </div>
  );
}
