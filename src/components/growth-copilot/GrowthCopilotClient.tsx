"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import type { CheckStatus, GrowthChecklistStep, GrowthCopilotView } from "@/lib/growth-copilot";

function track(event: string, props?: Record<string, unknown>) {
  void fetch("/api/first-run/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event, props }),
  }).catch(() => undefined);
}

function statusIcon(status: CheckStatus): string {
  if (status === "ready") return "✅";
  if (status === "needs_attention") return "🟠";
  if (status === "missing") return "🔴";
  if (status === "locked") return "🔒";
  return "⚪";
}

function statusLabel(status: CheckStatus): string {
  if (status === "ready") return "Ready";
  if (status === "needs_attention") return "Needs attention";
  if (status === "missing") return "Missing";
  if (status === "locked") return "Locked";
  return "Not enough data";
}

function ChecklistStepCard({
  step,
  onView,
}: {
  step: GrowthChecklistStep;
  onView: (id: string) => void;
}) {
  return (
    <article className="card growth-copilot-step">
      <header className="growth-copilot-step-header">
        <h3>
          <span aria-hidden="true">{statusIcon(step.status)}</span> {step.title}
        </h3>
        <span className={`growth-copilot-pill growth-copilot-pill-${step.status}`}>
          {statusLabel(step.status)}
        </span>
      </header>
      <p className="muted">{step.summary}</p>
      <ul className="growth-copilot-check-list">
        {step.items.map((item) => (
          <li key={item.id}>
            <span aria-hidden="true">{statusIcon(item.status)}</span>
            <div>
              <strong>{item.label}</strong>
              <p>{item.detail}</p>
            </div>
          </li>
        ))}
      </ul>
      {step.ctaHref && step.ctaLabel ? (
        <Link
          className="btn btn-secondary"
          href={step.ctaHref}
          onClick={() => onView(step.id)}
        >
          {step.ctaLabel}
        </Link>
      ) : null}
    </article>
  );
}

export function GrowthCopilotClient({ view }: { view: GrowthCopilotView }) {
  const tracked = useRef(false);
  const nba = view.nextBestAction;

  useEffect(() => {
    if (tracked.current) return;
    tracked.current = true;
    track("store_stage_detected", {
      stage: view.maturity.stage,
      experience: view.maturity.experience,
      orders: view.maturity.orders30d,
      revenue: view.maturity.revenue30d,
      products: view.maturity.productCount,
    });
    track("growth_checklist_viewed", {
      stage: view.maturity.stage,
      complete: view.progress.complete,
      total: view.progress.total,
    });
    track("next_best_action_shown", {
      id: nba.id,
      stepId: nba.stepId,
      stage: view.maturity.stage,
    });
    track("first_recommendation_shown", {
      source: "growth_copilot",
      recommendation_type: nba.id,
      recommendation_id: nba.recommendationId ?? nba.id,
    });
  }, [nba.id, nba.recommendationId, nba.stepId, view.maturity, view.progress]);

  function onTaskView(stepId: string) {
    track("growth_task_viewed", { stepId, stage: view.maturity.stage });
  }

  function onNbaClick() {
    track("next_best_action_clicked", {
      id: nba.id,
      stepId: nba.stepId,
      href: nba.ctaHref,
    });
  }

  const experienceLabel =
    view.maturity.experience === "guide_me"
      ? "Guide me"
      : view.maturity.experience === "optimize_me"
        ? "Optimize me"
        : "Improve profitability";

  return (
    <div className="growth-copilot">
      <header className="growth-copilot-welcome">
        <p className="growth-copilot-eyebrow">Welcome to StorePilot 👋</p>
        <h1>{view.headline}</h1>
        <p className="growth-copilot-lede">{view.lede}</p>
        <p className="muted growth-copilot-stage">
          {view.maturity.label} · {experienceLabel}
        </p>
        <p className="muted">{view.basedOn}</p>
      </header>

      <section className="card growth-copilot-nba" aria-labelledby="growth-nba-title">
        <p className="growth-copilot-eyebrow">Your next best action</p>
        <h2 id="growth-nba-title">
          <span aria-hidden="true">
            {nba.severity === "low" ? "🟢" : nba.severity === "medium" ? "🟠" : "🔴"}
          </span>{" "}
          {nba.title}
        </h2>
        <dl className="growth-copilot-nba-flow">
          <div>
            <dt>Problem</dt>
            <dd>{nba.problem}</dd>
          </div>
          <div>
            <dt>Why it matters</dt>
            <dd>{nba.whyItMatters}</dd>
          </div>
          <div>
            <dt>Recommended action</dt>
            <dd>{nba.recommendedAction}</dd>
          </div>
        </dl>
        <Link className="btn btn-primary" href={nba.ctaHref} onClick={onNbaClick}>
          {nba.ctaLabel} →
        </Link>
      </section>

      <section className="growth-copilot-known-grid" aria-label="What we know">
        <div className="card">
          <h3>What we know</h3>
          <ul className="growth-copilot-fact-list">
            {view.known.map((row) => (
              <li key={row.label}>
                <span>{row.label}</span>
                <strong>{row.value}</strong>
              </li>
            ))}
          </ul>
        </div>
        {view.unknown.length > 0 ? (
          <div className="card">
            <h3>What we don&apos;t know yet</h3>
            <ul className="growth-copilot-fact-list">
              {view.unknown.map((row) => (
                <li key={row.label}>
                  <span>{row.label}</span>
                  <strong>{row.value}</strong>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <section className="card growth-copilot-progress" aria-labelledby="growth-progress-title">
        <h2 id="growth-progress-title">Store Growth Progress</h2>
        <p className="growth-copilot-progress-label">{view.progress.label}</p>
        <ol className="growth-copilot-progress-list">
          {view.checklist.map((step) => (
            <li key={step.id}>
              <span aria-hidden="true">{statusIcon(step.status)}</span>
              {step.title}
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="growth-checklist-title">
        <h2 id="growth-checklist-title">Your Growth Checklist</h2>
        <div className="growth-copilot-steps">
          {view.checklist.map((step) => (
            <ChecklistStepCard key={step.id} step={step} onView={onTaskView} />
          ))}
        </div>
      </section>

      {view.maturity.stage === "new" && !view.showProfitabilityDashboard ? (
        <p className="muted growth-copilot-profit-note">
          Profitability insights will unlock as your store generates more data. We will not
          invent ROAS, profit, or conversion rate.
        </p>
      ) : (
        <p>
          <Link className="btn btn-ghost" href="/analytics/profit">
            Open profitability
          </Link>
        </p>
      )}

      <p className="growth-copilot-analytics-link">
        <Link href="/analytics/executive">View analytics dashboard</Link>
      </p>
    </div>
  );
}
