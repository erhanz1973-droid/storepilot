"use client";

import { useState } from "react";
import type { MerchantBenchmark, MerchantDNA } from "@/lib/merchant-dna/types";
import {
  AUTOMATION_LABELS,
  GROWTH_STAGE_LABELS,
  PERSONALITY_LABELS,
  PRODUCT_DNA_LABELS,
  TRAFFIC_MIX_LABELS,
  type AutomationPreference,
  type GrowthStage,
  type MerchantPersonality,
} from "@/lib/merchant-dna/types";
import { BUSINESS_MODEL_LABELS } from "@/lib/business-model/types";

type Props = {
  dna: MerchantDNA;
  benchmark?: MerchantBenchmark;
};

export function MerchantDnaPanel({ dna, benchmark }: Props) {
  const [personality, setPersonality] = useState(dna.personality);
  const [growthStage, setGrowthStage] = useState(dna.growthStage);
  const [automation, setAutomation] = useState(dna.automationPreference);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function save(patch: Record<string, string>) {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/store/merchant-dna", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error("Save failed");
      setMessage("Merchant DNA updated. Decisions will adapt on refresh.");
    } catch {
      setMessage("Could not save Merchant DNA settings.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Merchant DNA</h3>
      <p className="muted" style={{ fontSize: "0.9rem" }}>
        Your operating profile — decisions rank and explain themselves based on how you run the
        business. DNA evolves as you approve or reject recommendations.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
          gap: 10,
          marginBottom: 16,
        }}
      >
        <DnaChip label="Model" value={BUSINESS_MODEL_LABELS[dna.businessModel]} />
        <DnaChip label="Stage" value={GROWTH_STAGE_LABELS[dna.growthStage]} />
        <DnaChip label="Traffic" value={TRAFFIC_MIX_LABELS[dna.trafficMix]} />
        <DnaChip label="Catalog" value={PRODUCT_DNA_LABELS[dna.productDna]} />
        <DnaChip label="AOV" value={dna.averageOrderValue ? `$${dna.averageOrderValue.toFixed(0)}` : "—"} />
        <DnaChip label="Margin" value={dna.typicalMarginPct != null ? `${dna.typicalMarginPct.toFixed(0)}%` : "—"} />
      </div>

      <pre
        style={{
          fontSize: "0.8rem",
          whiteSpace: "pre-wrap",
          background: "var(--surface)",
          padding: 12,
          borderRadius: 8,
          marginBottom: 16,
        }}
      >
        {dna.personalizationNarrative}
      </pre>

      {benchmark && (
        <div style={{ marginBottom: 16 }}>
          <p className="muted" style={{ margin: "0 0 8px", fontSize: "0.85rem" }}>
            Benchmark cohort: {benchmark.cohortLabel} (~{benchmark.similarMerchantCount} similar stores)
          </p>
          <div style={{ display: "grid", gap: 6 }}>
            {benchmark.metrics.map((m) => (
              <div key={m.id} className="breakdown-row" style={{ fontSize: "0.85rem" }}>
                <span>{m.label}</span>
                <span>
                  {formatMetric(m.merchantValue, m.unit)} · {m.cohortPercentile}th percentile
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: "grid", gap: 12 }}>
        <label style={{ fontSize: "0.85rem" }}>
          Personality
          <select
            className="input"
            value={personality}
            disabled={saving}
            onChange={(e) => {
              const v = e.target.value as MerchantPersonality;
              setPersonality(v);
              void save({ personality: v });
            }}
            style={{ display: "block", width: "100%", marginTop: 4 }}
          >
            {(Object.keys(PERSONALITY_LABELS) as MerchantPersonality[]).map((k) => (
              <option key={k} value={k}>
                {PERSONALITY_LABELS[k]}
              </option>
            ))}
          </select>
        </label>

        <label style={{ fontSize: "0.85rem" }}>
          Growth stage (override)
          <select
            className="input"
            value={growthStage}
            disabled={saving}
            onChange={(e) => {
              const v = e.target.value as GrowthStage;
              setGrowthStage(v);
              void save({ growthStage: v });
            }}
            style={{ display: "block", width: "100%", marginTop: 4 }}
          >
            {(Object.keys(GROWTH_STAGE_LABELS) as GrowthStage[]).map((k) => (
              <option key={k} value={k}>
                {GROWTH_STAGE_LABELS[k]}
              </option>
            ))}
          </select>
        </label>

        <label style={{ fontSize: "0.85rem" }}>
          Automation preference
          <select
            className="input"
            value={automation}
            disabled={saving}
            onChange={(e) => {
              const v = e.target.value as AutomationPreference;
              setAutomation(v);
              void save({ automationPreference: v });
            }}
            style={{ display: "block", width: "100%", marginTop: 4 }}
          >
            {(Object.keys(AUTOMATION_LABELS) as AutomationPreference[]).map((k) => (
              <option key={k} value={k}>
                {AUTOMATION_LABELS[k]}
              </option>
            ))}
          </select>
        </label>
      </div>

      {(dna.learned.tooAggressiveRejections ?? 0) > 0 && (
        <p className="muted" style={{ marginTop: 12, fontSize: "0.8rem" }}>
          Learned: {dna.learned.tooAggressiveRejections} aggressive rejection(s) — scaling suggestions
          deprioritized.
        </p>
      )}

      {message && <p style={{ marginTop: 12, marginBottom: 0, fontSize: "0.9rem" }}>{message}</p>}
    </div>
  );
}

function DnaChip({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)" }}>
      <div className="muted" style={{ fontSize: "0.7rem", textTransform: "uppercase" }}>
        {label}
      </div>
      <strong style={{ fontSize: "0.85rem" }}>{value}</strong>
    </div>
  );
}

function formatMetric(value: number, unit: string): string {
  if (unit === "currency") return `$${Math.round(value)}`;
  if (unit === "percent") return `${value.toFixed(1)}%`;
  if (unit === "ratio") return value.toFixed(2);
  return String(Math.round(value));
}
