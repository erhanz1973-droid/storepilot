"use client";

import { MerchantModeWeightsPanel } from "@/components/decisions/MerchantModeWeightsPanel";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  MERCHANT_MODE_DESCRIPTIONS,
  MERCHANT_MODE_LABELS,
  MODE_SCORE_WEIGHTS,
  type MerchantMode,
} from "@/lib/decisions/merchant-mode";
import { formatModeWeights } from "@/lib/decisions/engine/mode-weights";

const MODES: MerchantMode[] = [
  "profit",
  "cash_flow",
  "growth",
  "inventory_clearance",
  "launch",
];

export function MerchantModeSelector({ initialMode }: { initialMode: MerchantMode }) {
  const router = useRouter();
  const [mode, setMode] = useState(initialMode);
  const [saving, setSaving] = useState(false);

  async function handleChange(next: MerchantMode) {
    const previous = mode;
    setMode(next);
    setSaving(true);
    try {
      await fetch("/api/decisions/merchant-mode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: next }),
      });
      router.refresh();
    } catch {
      setMode(previous);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card merchant-mode-card">
      <h3>Business objective</h3>
      <p className="muted" style={{ marginTop: 4, marginBottom: 12, fontSize: "0.9rem" }}>
        The AI ranks strategies by expected net profit — weighted by your selected mode.
      </p>
      <div className="merchant-mode-grid">
        {MODES.map((item) => (
          <button
            key={item}
            type="button"
            className={`merchant-mode-option ${mode === item ? "active" : ""}`}
            onClick={() => handleChange(item)}
            disabled={saving}
          >
            <strong>{MERCHANT_MODE_LABELS[item]}</strong>
            <span>{MERCHANT_MODE_DESCRIPTIONS[item]}</span>
          </button>
        ))}
      </div>
      {mode in MODE_SCORE_WEIGHTS && (
        <MerchantModeWeightsPanel mode={mode} weights={formatModeWeights(mode)} />
      )}
    </div>
  );
}
