"use client";

import type {
  ProviderValidationState,
  RecommendationValidationMeta,
  ValidationGateReport,
} from "@/lib/recommendations/validation/types";
import { formatMinutesAgo } from "@/lib/recommendations/validation/confidence";
import { READINESS_LABELS } from "@/lib/recommendations/validation/readiness";

type Props = {
  validation?: RecommendationValidationMeta;
  gate?: ValidationGateReport;
  confidencePct: number;
  summary: string;
};

function EvidenceRow({ item }: { item: { label: string; passed: boolean; detail?: string } }) {
  return (
    <li style={{ marginBottom: 4, fontSize: "0.85rem", listStyle: "none" }}>
      <span style={{ color: item.passed ? "#22c55e" : "#ef4444", marginRight: 6 }}>
        {item.passed ? "✓" : "✗"}
      </span>
      {item.label}
      {item.detail ? <span className="muted"> — {item.detail}</span> : null}
    </li>
  );
}

function FreshnessBadge({ provider }: { provider: ProviderValidationState }) {
  const color =
    provider.freshness === "fresh" ? "#22c55e" : provider.freshness === "stale" ? "#eab308" : "#94a3b8";
  return (
    <span style={{ color, fontWeight: 600, textTransform: "capitalize" }}>{provider.freshness}</span>
  );
}

export function RecommendationEvidencePanel({ validation, gate, confidencePct, summary }: Props) {
  if (!validation && !gate) return null;

  const aiPct = validation ? Math.round(validation.aiConfidence * 100) : confidencePct;
  const valPct = validation ? Math.round(validation.validationConfidence * 100) : null;
  const finalPct = validation ? Math.round(validation.finalConfidence * 100) : confidencePct;

  return (
    <div
      className="decision-card-section"
      style={{
        marginTop: 12,
        padding: 14,
        borderRadius: 10,
        background: "rgba(99,102,241,0.06)",
        border: "1px solid rgba(99,102,241,0.15)",
      }}
    >
      <p className="decision-section-label" style={{ marginBottom: 10 }}>
        Evidence
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 12 }}>
        <div>
          <p className="muted" style={{ margin: 0, fontSize: "0.75rem" }}>AI Confidence</p>
          <strong>{aiPct}%</strong>
        </div>
        {valPct !== null && (
          <div>
            <p className="muted" style={{ margin: 0, fontSize: "0.75rem" }}>Validation Confidence</p>
            <strong>{valPct}%</strong>
          </div>
        )}
        <div>
          <p className="muted" style={{ margin: 0, fontSize: "0.75rem" }}>Final Confidence</p>
          <strong>{finalPct}%</strong>
        </div>
      </div>

      {validation?.evidence && validation.evidence.length > 0 && (
        <ul style={{ margin: "0 0 12px", padding: 0 }}>
          {validation.evidence.map((item) => (
            <EvidenceRow key={item.id} item={item} />
          ))}
        </ul>
      )}

      {validation?.calculationBasis && validation.calculationBasis.length > 0 && (
        <>
          <p className="decision-section-label" style={{ marginBottom: 6 }}>
            Based on — {summary}
          </p>
          <div className="stack" style={{ marginBottom: 12 }}>
            {validation.calculationBasis.slice(0, 6).map((row) => (
              <div key={row.label} className="breakdown-row" style={{ fontSize: "0.85rem" }}>
                <span>{row.label}</span>
                <strong>{row.value}</strong>
              </div>
            ))}
          </div>
        </>
      )}

      {gate && (
        <>
          <p className="decision-section-label" style={{ marginBottom: 6 }}>
            Data sources
          </p>
          <div className="stack" style={{ gap: 6 }}>
            {gate.providers
              .filter((p) => p.connected)
              .map((p) => (
                <div key={p.providerId} className="breakdown-row" style={{ fontSize: "0.85rem" }}>
                  <span>{p.label}</span>
                  <span>
                    {p.trustLevel === "blocked" ? (
                      <span style={{ color: "#ef4444" }}>Not Used (Validation Failed)</span>
                    ) : p.trustLevel === "trusted" ? (
                      <span style={{ color: "#22c55e" }}>Validated</span>
                    ) : (
                      <span style={{ color: "#eab308" }}>Validated (Warning)</span>
                    )}
                  </span>
                </div>
              ))}
          </div>

          <p className="decision-section-label" style={{ margin: "12px 0 6px" }}>
            Data freshness
          </p>
          <div className="stack" style={{ gap: 6 }}>
            {gate.providers
              .filter((p) => p.connected)
              .map((p) => (
                <div key={`fresh-${p.providerId}`} className="breakdown-row" style={{ fontSize: "0.85rem" }}>
                  <span>{p.label}</span>
                  <span>
                    <FreshnessBadge provider={p} /> · {formatMinutesAgo(p.dataAgeMinutes)}
                  </span>
                </div>
              ))}
          </div>
        </>
      )}
    </div>
  );
}

export function ProviderReadinessPanel({ gate }: { gate?: ValidationGateReport }) {
  if (!gate) return null;

  return (
    <div style={{ marginTop: 16 }}>
      <h4 style={{ margin: "0 0 8px" }}>Provider Readiness</h4>
      <div className="stack">
        {gate.providers.map((p) => (
          <div key={p.providerId} className="breakdown-row">
            <span>{p.label}</span>
            <strong>{READINESS_LABELS[p.readiness]}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

export function RecommendationValidationBlocker({ gate }: { gate: ValidationGateReport }) {
  if (gate.canGenerateRecommendations) return null;

  const failed = gate.providers.filter((p) => p.trustLevel === "blocked");

  return (
    <div
      className="card"
      style={{
        marginBottom: 20,
        border: "1px solid rgba(239,68,68,0.35)",
        background: "rgba(239,68,68,0.06)",
      }}
    >
      <h3 style={{ margin: "0 0 8px" }}>Unable to generate recommendations</h3>
      <p className="muted" style={{ margin: "0 0 12px" }}>
        Validation gate blocked recommendation generation. Data sources must pass validation before AI can
        recommend actions.
      </p>
      {failed.map((p) => (
        <div key={p.providerId} style={{ marginBottom: 8 }}>
          <strong>{p.label} Validation Failed</strong>
          <p className="muted" style={{ margin: "4px 0 0", fontSize: "0.9rem" }}>
            Validation Score: {p.matchScore ?? 0}%
          </p>
        </div>
      ))}
      <a href="/connections?tab=advertising" className="btn btn-secondary" style={{ marginTop: 8 }}>
        Run Validation
      </a>
    </div>
  );
}
