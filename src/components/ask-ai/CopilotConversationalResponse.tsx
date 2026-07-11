"use client";

import { useState } from "react";
import type { CopilotStructuredResponse } from "@/lib/copilot/types";
import { confidenceLabel } from "@/lib/copilot/conversational-enrichment";

function renderInlineMarkdown(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return <span key={i}>{part}</span>;
  });
}

function riskLabel(level: string): string {
  return level.charAt(0).toUpperCase() + level.slice(1);
}

export function CopilotConversationalResponse({
  structured,
  onFollowUp,
}: {
  structured: CopilotStructuredResponse;
  onFollowUp?: (question: string) => void;
}) {
  const conv = structured.conversational;
  const [impactOpen, setImpactOpen] = useState(false);
  const [remainingOpen, setRemainingOpen] = useState(false);

  if (!conv) return null;

  const isWait = conv.mode === "wait";
  const isWhyPriority = conv.mode === "why_priority";

  return (
    <div className="copilot-conversational">
      <section className="copilot-short-answer">
        <p className="copilot-section-label">
          {isWait ? "If you wait" : isWhyPriority ? "Why this is first" : "Direct answer"}
        </p>
        <p className="copilot-short-answer-text">{renderInlineMarkdown(conv.shortAnswer)}</p>
        {conv.cautionNote && (
          <p className="copilot-caution">{renderInlineMarkdown(conv.cautionNote)}</p>
        )}
      </section>

      {conv.whySummary && (
        <section className="copilot-why">
          <h4 className="copilot-section-heading">
            {isWait ? "Consequences" : "Why this matters"}
          </h4>
          <p className="copilot-why-summary">{conv.whySummary}</p>
          {!isWait && !isWhyPriority && conv.supportingMetrics.length > 0 && (
            <ul className="copilot-why-list copilot-supporting-metrics">
              {conv.supportingMetrics.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          )}
        </section>
      )}

      {isWait && (
        <section className="copilot-wait-analysis">
          <dl className="copilot-wait-grid">
            <div>
              <dt>Estimated unnecessary ad spend</dt>
              <dd>{conv.waitAnalysis.unnecessarySpend ?? "—"}</dd>
            </div>
            <div>
              <dt>Estimated missed profit</dt>
              <dd>{conv.waitAnalysis.missedProfit ?? "—"}</dd>
            </div>
            <div>
              <dt>Campaign learning quality</dt>
              <dd>{conv.waitAnalysis.learningQuality}</dd>
            </div>
            <div>
              <dt>Business risk</dt>
              <dd className="copilot-risk-moderate">{conv.waitAnalysis.businessRisk}</dd>
            </div>
          </dl>
        </section>
      )}

      {!isWait && conv.financialImpact.calculable && conv.financialImpact.combinedNetMonthly != null && (
        <section className="copilot-financial-impact">
          <p className="copilot-section-label">Financial impact</p>
          <p className="copilot-impact-positive copilot-combined-impact">
            {conv.financialImpact.combinedLabel}
          </p>
          {conv.financialImpact.overlapNote && (
            <p className="muted" style={{ margin: "6px 0 0", fontSize: "0.82rem", lineHeight: 1.45 }}>
              {conv.financialImpact.overlapNote}
            </p>
          )}
        </section>
      )}

      {!isWait && conv.prioritizedRecommendations.length > 0 && (
        <section className="copilot-priorities">
          <p className="copilot-section-label">Today — do these {conv.prioritizedRecommendations.length} things</p>
          <div className="copilot-rec-cards">
            {conv.prioritizedRecommendations.map((rec) => (
              <article key={rec.rank} className="copilot-rec-card copilot-rec-card-compact">
                <header className="copilot-rec-head">
                  <span className="copilot-priority-badge">Priority {rec.rank}</span>
                  <span className="copilot-effort-badge">{rec.effortLabel}</span>
                </header>
                <p className="copilot-rec-action">{renderInlineMarkdown(rec.recommendedAction)}</p>
                <p className="muted copilot-rec-problem" style={{ margin: "4px 0 0", fontSize: "0.85rem" }}>
                  {rec.problem}
                </p>
                {rec.rank === 1 && !isWhyPriority && (
                  <div className="copilot-why-first">
                    <span className="muted" style={{ fontSize: "0.75rem" }}>Why this is first</span>
                    <ul>
                      {conv.whyFirstPriority.map((r) => (
                        <li key={r}>{r}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </article>
            ))}
          </div>
        </section>
      )}

      {!isWait && !isWhyPriority && conv.tradeOff && (
        <section className="copilot-tradeoff">
          <p className="copilot-section-label">If you approve</p>
          <dl className="copilot-tradeoff-grid">
            <div>
              <dt>{conv.tradeOff.upsideLabel}</dt>
              <dd className="copilot-impact-positive">{conv.tradeOff.upsideValue}</dd>
            </div>
            <div>
              <dt>{conv.tradeOff.downsideLabel}</dt>
              <dd>{conv.tradeOff.downsideValue}</dd>
            </div>
            <div>
              <dt>Expected stabilization</dt>
              <dd>{conv.tradeOff.stabilizationTime}</dd>
            </div>
          </dl>
        </section>
      )}

      {!isWait && (
        <section className="copilot-confidence-block copilot-confidence-standalone">
          <p className="copilot-section-label">Why I am confident ({conv.confidence.pct}%)</p>
          <ul className="copilot-basis-list">
            {conv.confidence.basis.map((b) => (
              <li key={b}>✓ {b}</li>
            ))}
          </ul>
        </section>
      )}

      {!isWait && !isWhyPriority && conv.whyNotAlternatives.length > 0 && (
        <section className="copilot-why-not">
          <p className="copilot-section-label">Why not other recommendations?</p>
          <ul className="copilot-why-not-list">
            {conv.whyNotAlternatives.map((alt) => (
              <li key={alt.label}>
                <strong>{alt.label}</strong> — {alt.reason}
              </li>
            ))}
          </ul>
        </section>
      )}

      {!isWait && conv.remainingOpportunityCount > 0 && (
        <section className="copilot-remaining">
          <button
            type="button"
            className="copilot-impact-toggle"
            onClick={() => setRemainingOpen((o) => !o)}
            aria-expanded={remainingOpen}
          >
            View remaining opportunities ({conv.remainingOpportunityCount})
            <span className="muted">{remainingOpen ? "−" : "+"}</span>
          </button>
          {remainingOpen && (
            <p className="muted" style={{ margin: "8px 0 0", fontSize: "0.85rem" }}>
              {conv.remainingOpportunityCount} additional opportunities are queued — focus on today&apos;s top{" "}
              {conv.prioritizedRecommendations.length} actions first.
            </p>
          )}
        </section>
      )}

      {!isWait && (
        <section className="copilot-next-step">
          <p className="copilot-section-label">Recommended next step</p>
          <p className="copilot-next-step-text">{renderInlineMarkdown(conv.nextStep)}</p>
          <p className="muted" style={{ margin: "6px 0 0", fontSize: "0.82rem" }}>
            Estimated completion time: <strong>{conv.nextStepDuration}</strong>
          </p>
        </section>
      )}

      <section className="copilot-impact-expand">
        <button
          type="button"
          className="copilot-impact-toggle"
          onClick={() => setImpactOpen((o) => !o)}
          aria-expanded={impactOpen}
        >
          How this estimate was calculated
          <span className="muted">{impactOpen ? "−" : "+"}</span>
        </button>
        {impactOpen && (
          <div className="copilot-impact-body">
            <ul className="copilot-why-list">
              {conv.impactCalculation.factors.map((f) => (
                <li key={f}>• {f}</li>
              ))}
            </ul>
            <p className="muted" style={{ margin: "8px 0 0", fontSize: "0.85rem", lineHeight: 1.45 }}>
              {conv.impactCalculation.summary}
            </p>
          </div>
        )}
      </section>

      {conv.followUpQuestion && onFollowUp && (
        <section className="copilot-followups">
          <p className="copilot-section-label">Follow-up</p>
          <button
            type="button"
            className="copilot-followup-chip copilot-followup-single"
            onClick={() => onFollowUp(conv.followUpQuestion)}
          >
            {conv.followUpQuestion}
          </button>
        </section>
      )}
    </div>
  );
}
