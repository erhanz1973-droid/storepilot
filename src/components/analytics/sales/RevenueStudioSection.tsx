"use client";

import { useState } from "react";
import Link from "next/link";
import type { RevenuePlaybook, RevenueStudio } from "@/lib/analytics/revenue-studio";

function fmt(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function PreviewPanel({
  playbook,
  onClose,
}: {
  playbook: RevenuePlaybook;
  onClose: () => void;
}) {
  return (
    <div className="rev-studio-preview-overlay" role="dialog" aria-modal="true">
      <div className="card rev-studio-preview">
        <div className="rev-studio-preview-head">
          <h3 style={{ margin: 0 }}>Business Decision Summary</h3>
          <button type="button" className="rev-studio-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <p className="rev-studio-preview-title">{playbook.title}</p>

        <div className="rev-studio-preview-grid">
          <div>
            <span className="muted">Expected Revenue Increase</span>
            <strong className="positive">+{fmt(playbook.expectedRevenueMonthly)}/month</strong>
          </div>
          <div>
            <span className="muted">Expected Profit Recovery</span>
            <strong className="positive">+{fmt(playbook.expectedProfitMonthly)}/month</strong>
          </div>
          {playbook.expectedAovLiftPct != null && (
            <div>
              <span className="muted">Expected Average Order Value Lift</span>
              <strong className="positive">+{playbook.expectedAovLiftPct}%</strong>
            </div>
          )}
          <div>
            <span className="muted">Estimated Time to Launch</span>
            <strong>{playbook.timeToLaunch}</strong>
          </div>
        </div>

        <div className="rev-studio-preview-section">
          <span className="muted">Inventory Impact</span>
          <p>{playbook.inventoryImpact}</p>
        </div>

        {playbook.whyNow.length > 0 && (
          <div className="rev-studio-preview-section rev-studio-why-now">
            <span className="muted">Why now?</span>
            <ul>
              {playbook.whyNow.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="rev-studio-preview-section">
          <span className="muted">Confidence</span>
          <p>
            <strong>{playbook.confidence}</strong> — {playbook.confidenceExplanation}
          </p>
        </div>

        <div className="rev-studio-preview-section">
          <span className="muted">Products Affected</span>
          <ul>
            {playbook.productsAffected.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>

        <div className="rev-studio-preview-section">
          <span className="muted">Business Reasoning</span>
          <p>{playbook.businessReasoning}</p>
        </div>

        <div className="rev-studio-preview-section">
          <span className="muted">Potential Risks</span>
          <ul className="rev-studio-risks">
            {playbook.risks.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>

        <div className="rev-studio-preview-actions">
          <Link href={playbook.approvalHref} className="btn btn-primary btn-sm">
            Send to Approval Center
          </Link>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function PlaybookCard({
  playbook,
  onPreview,
}: {
  playbook: RevenuePlaybook;
  onPreview: () => void;
}) {
  return (
    <article className={`rev-studio-card rev-studio-kind-${playbook.kind}`}>
      <div className="rev-studio-card-head">
        <span className="rev-studio-kind">Revenue Playbook</span>
        <span className="rev-studio-category">{playbook.category}</span>
        <h4>{playbook.title}</h4>
        {playbook.productLine && (
          <p className="rev-studio-product-line muted">{playbook.productLine}</p>
        )}
      </div>

      <div className="rev-studio-results">
        <div>
          <span className="muted">Expected Monthly Profit Recovery</span>
          <strong className="positive">+{fmt(playbook.expectedProfitMonthly)}/month</strong>
        </div>
        <div>
          <span className="muted">Estimated Time</span>
          <strong>{playbook.timeToLaunch}</strong>
        </div>
        <div>
          <span className="muted">Confidence</span>
          <strong>{playbook.confidence}</strong>
          <p className="rev-studio-confidence-explanation">{playbook.confidenceExplanation}</p>
        </div>
      </div>

      {playbook.whyNow.length > 0 && (
        <div className="rev-studio-why-now">
          <span className="muted">Why now?</span>
          <ul>
            {playbook.whyNow.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="rev-studio-why">
        <span className="muted">Why AI recommends this {playbook.kind === "bundle" ? "bundle" : "action"}</span>
        <ul className="rev-studio-why-checklist">
          {playbook.whyBullets.map((b) => (
            <li key={b}>
              <span className="rev-studio-check" aria-hidden>
                ✓
              </span>
              {b}
            </li>
          ))}
        </ul>
      </div>

      <div className="rev-studio-card-actions">
        <button type="button" className="btn btn-secondary btn-sm" onClick={onPreview}>
          Preview
        </button>
        <Link href={playbook.approvalHref} className="btn btn-primary btn-sm">
          Send to Approval Center
        </Link>
      </div>

      <div className="rev-studio-followups">
        <Link
          href={`/ask-ai?q=${encodeURIComponent(`Why did you recommend ${playbook.title}?`)}`}
          className="rev-studio-followup-chip"
        >
          Why this playbook?
        </Link>
        <Link
          href={`/ask-ai?q=${encodeURIComponent("Show evidence for this revenue action")}`}
          className="rev-studio-followup-chip"
        >
          Show evidence
        </Link>
      </div>
    </article>
  );
}

export function RevenueStudioSection({ studio }: { studio: RevenueStudio }) {
  const [previewId, setPreviewId] = useState<string | null>(null);
  const previewPlaybook = studio.playbooks.find((p) => p.id === previewId) ?? null;

  if (studio.playbooks.length === 0) return null;

  return (
    <section className="card rev-studio">
      <h3 style={{ marginTop: 0 }}>{studio.headline}</h3>
      <p className="muted rev-studio-sub">{studio.subhead}</p>

      <div className="rev-studio-workflow" aria-label="Revenue playbook workflow">
        {studio.workflow.map((step, i) => (
          <span key={step} className="rev-studio-workflow-step">
            {step}
            {i < studio.workflow.length - 1 && (
              <span className="rev-studio-workflow-arrow" aria-hidden>
                ↓
              </span>
            )}
          </span>
        ))}
      </div>

      <div className="rev-studio-grid">
        {studio.playbooks.map((playbook) => (
          <PlaybookCard
            key={playbook.id}
            playbook={playbook}
            onPreview={() => setPreviewId(playbook.id)}
          />
        ))}
      </div>

      {previewPlaybook && (
        <PreviewPanel playbook={previewPlaybook} onClose={() => setPreviewId(null)} />
      )}
    </section>
  );
}
