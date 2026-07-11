import type { ModeWeightDisplay } from "@/lib/decisions/engine/types";
import { MERCHANT_MODE_LABELS, type MerchantMode } from "@/lib/decisions/merchant-mode";

type Props = {
  mode: MerchantMode;
  weights: ModeWeightDisplay[];
};

export function MerchantModeWeightsPanel({ mode, weights }: Props) {
  return (
    <div style={{ marginTop: 12 }}>
      <p className="muted" style={{ fontSize: "0.82rem", margin: "0 0 8px" }}>
        {MERCHANT_MODE_LABELS[mode]} — decision weights
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {weights.slice(0, 5).map((w) => (
          <span key={w.label} className="merchant-mode-weight-chip">
            {w.label} <strong>{w.weightPct}%</strong>
          </span>
        ))}
      </div>
    </div>
  );
}
