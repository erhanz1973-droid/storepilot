"use client";

import { useEffect, useId, useRef } from "react";
import type { ExplainedValue, CalculationStep } from "@/lib/calculations/audit/types";
import { FORMULA_ENGINE_VERSION } from "@/lib/calculations/version";

function formatStepValue(step: CalculationStep): string {
  if (step.value == null) return "—";
  if (typeof step.value === "string") return step.value;
  if (step.unit === "percent") return `${step.value}%`;
  if (step.unit === "ratio") return String(step.value);
  if (step.unit === "currency") {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(step.value);
  }
  return String(step.value);
}

function StepWaterfall({ steps }: { steps: CalculationStep[] }) {
  return (
    <ol className="metric-explain-waterfall">
      {steps.map((step, i) => (
        <li key={`${step.label}-${i}`} className="metric-explain-step">
          <div className="metric-explain-step-row">
            <span>
              {step.label}
              {step.assumed ? <em className="metric-explain-assumed"> (assumed)</em> : null}
              {step.source ? <span className="muted"> · {step.source}</span> : null}
            </span>
            <strong>{formatStepValue(step)}</strong>
          </div>
          {i < steps.length - 1 ? (
            <span className="metric-explain-arrow" aria-hidden>
              ↓
            </span>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

export function MetricExplainDrawer({
  open,
  onClose,
  title,
  explained,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  explained: ExplainedValue;
}) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const lastUpdated = explained.lastUpdatedAt
    ? new Date(explained.lastUpdatedAt).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : null;

  return (
    <div className="metric-explain-overlay" role="presentation" onClick={onClose}>
      <aside
        className="metric-explain-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="metric-explain-header">
          <div>
            <p className="metric-explain-eyebrow">How this number is calculated</p>
            <h3 id={titleId}>{title}</h3>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="btn btn-ghost"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </header>

        <div className="metric-explain-value">
          {explained.value != null && explained.value !== undefined ? (
            <p className="metric-explain-result">
              {typeof explained.value === "number"
                ? new Intl.NumberFormat("en-US", {
                    style: "currency",
                    currency: "USD",
                    maximumFractionDigits: 0,
                  }).format(explained.value)
                : String(explained.value)}
            </p>
          ) : null}
        </div>

        <StepWaterfall steps={explained.intermediateSteps} />

        <dl className="metric-explain-meta">
          <div>
            <dt>Formula</dt>
            <dd>{explained.formula}</dd>
          </div>
          <div>
            <dt>Formula version</dt>
            <dd>
              {explained.formulaVersion || FORMULA_ENGINE_VERSION}
              <span className="muted"> · {explained.formulaId}</span>
            </dd>
          </div>
          {explained.dataSources && explained.dataSources.length > 0 ? (
            <div>
              <dt>Data sources</dt>
              <dd>
                <ul className="metric-explain-sources">
                  {explained.dataSources.map((s) => (
                    <li key={s}>✓ {s}</li>
                  ))}
                </ul>
              </dd>
            </div>
          ) : null}
          {lastUpdated ? (
            <div>
              <dt>Last updated</dt>
              <dd>{lastUpdated}</dd>
            </div>
          ) : null}
          {explained.confidencePct != null ? (
            <div>
              <dt>Confidence</dt>
              <dd>{explained.confidencePct}%</dd>
            </div>
          ) : null}
          {explained.assumptions && explained.assumptions.length > 0 ? (
            <div>
              <dt>Assumptions</dt>
              <dd>
                <ul>
                  {explained.assumptions.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              </dd>
            </div>
          ) : null}
          {explained.warnings && explained.warnings.length > 0 ? (
            <div>
              <dt>Warnings</dt>
              <dd className="metric-explain-warnings">
                <ul>
                  {explained.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </dd>
            </div>
          ) : null}
        </dl>
      </aside>
    </div>
  );
}
