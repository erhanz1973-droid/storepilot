"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  BUSINESS_MODEL_DESCRIPTIONS,
  BUSINESS_MODEL_LABELS,
  type BusinessModel,
  type MerchantBusinessProfile,
} from "@/lib/business-model/types";

type Props = {
  profile: MerchantBusinessProfile;
};

export function BusinessModelSelector({ profile }: Props) {
  const router = useRouter();
  const [model, setModel] = useState<BusinessModel>(profile.businessModel);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const activeModel = profile.businessModelSource === "manual" ? profile.businessModel : model;
  const detected = profile.detectedBusinessModel;
  const showSuggestion =
    detected != null &&
    detected !== activeModel &&
    (profile.detectionConfidence ?? 0) >= 0.5;

  async function save(next: BusinessModel) {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/store/business-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessModel: next }),
      });
      if (!res.ok) throw new Error("Save failed");
      const json = (await res.json()) as { profile: MerchantBusinessProfile };
      setModel(json.profile.businessModel);
      setMessage(
        `Using ${BUSINESS_MODEL_LABELS[json.profile.businessModel]}. Decisions and inventory insights will adapt on refresh.`,
      );
      router.refresh();
    } catch {
      setMessage("Could not save business model.");
      setModel(profile.businessModel);
    } finally {
      setSaving(false);
    }
  }

  async function acceptDetection() {
    if (!detected) return;
    await save(detected);
  }

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Business Model</h3>
      <p className="muted" style={{ fontSize: "0.9rem" }}>
        StorePilot adapts recommendations to how your store operates. Manual selection always wins
        over auto-detection.
      </p>

      {profile.businessModelSource === "manual" && (
        <p
          style={{
            margin: "0 0 12px",
            padding: "8px 12px",
            borderRadius: 8,
            background: "rgba(22, 163, 74, 0.08)",
            border: "1px solid rgba(22, 163, 74, 0.2)",
            fontSize: "0.875rem",
          }}
        >
          Active: <strong>{BUSINESS_MODEL_LABELS[profile.businessModel]}</strong> (your selection)
        </p>
      )}

      <div style={{ display: "grid", gap: 8 }}>
        {(Object.keys(BUSINESS_MODEL_LABELS) as BusinessModel[]).map((key) => (
          <label
            key={key}
            style={{
              display: "flex",
              gap: 10,
              alignItems: "flex-start",
              padding: "10px 12px",
              borderRadius: 8,
              border:
                (profile.businessModelSource === "manual" ? profile.businessModel : model) === key
                  ? "1px solid var(--accent)"
                  : "1px solid var(--border)",
              cursor: saving ? "wait" : "pointer",
            }}
          >
            <input
              type="radio"
              name="business-model"
              checked={
                (profile.businessModelSource === "manual" ? profile.businessModel : model) === key
              }
              disabled={saving}
              onChange={() => {
                setModel(key);
                void save(key);
              }}
            />
            <span>
              <strong>{BUSINESS_MODEL_LABELS[key]}</strong>
              <br />
              <span className="muted" style={{ fontSize: "0.85rem" }}>
                {BUSINESS_MODEL_DESCRIPTIONS[key]}
              </span>
            </span>
          </label>
        ))}
      </div>

      {showSuggestion && (
        <div className="business-model-suggestion" style={{ marginTop: 12 }}>
          <p className="muted" style={{ margin: "0 0 8px", fontSize: "0.85rem" }}>
            Auto-detected: {BUSINESS_MODEL_LABELS[detected!]} (
            {Math.round((profile.detectionConfidence ?? 0) * 100)}% confidence) — based on catalog
            signals. This is a suggestion only; your selection above controls active behavior.
          </p>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={saving}
            onClick={() => void acceptDetection()}
          >
            Use detected model
          </button>
        </div>
      )}

      {!showSuggestion && detected && profile.businessModelSource === "manual" && (
        <p className="muted" style={{ marginTop: 12, fontSize: "0.85rem" }}>
          Detection also suggests {BUSINESS_MODEL_LABELS[detected]} (
          {Math.round((profile.detectionConfidence ?? 0) * 100)}% confidence) — overridden by your
          selection.
        </p>
      )}

      {message && (
        <p style={{ marginTop: 12, marginBottom: 0, fontSize: "0.9rem" }}>{message}</p>
      )}
    </div>
  );
}
