"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { FirstRunApprovePreview } from "@/components/first-run/FirstRunApprovePreview";
import { FirstRunDecisionCard } from "@/components/first-run/FirstRunDecisionCard";
import { FirstRunProgress } from "@/components/first-run/FirstRunProgress";
import { FirstRunWhyPanel } from "@/components/first-run/FirstRunWhyPanel";
import type { FirstRunAnalyzeResult, FirstRunStage } from "@/lib/first-run/types";

const WELCOME_STAGES: FirstRunStage[] = [
  { id: "shopify_connected", label: "Shopify connected", status: "done" },
  { id: "analyzing_products", label: "Analyzing products…", status: "active" },
  { id: "analyzing_orders", label: "Analyzing orders…", status: "pending" },
  { id: "checking_inventory", label: "Checking inventory…", status: "pending" },
  { id: "calculating_profitability", label: "Calculating profitability…", status: "pending" },
  {
    id: "looking_for_growth",
    label: "Looking for growth opportunities…",
    status: "pending",
  },
  {
    id: "preparing_briefing",
    label: "Preparing your executive briefing…",
    status: "pending",
  },
];

type Phase = "welcome" | "analyzing" | "decision" | "empty";

async function track(event: string, props?: Record<string, unknown>) {
  try {
    await fetch("/api/first-run/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, props }),
    });
  } catch {
    // non-blocking
  }
}

export function FirstRunExperience({ installed }: { installed?: boolean }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("welcome");
  const [stages, setStages] = useState<FirstRunStage[]>(WELCOME_STAGES);
  const [result, setResult] = useState<FirstRunAnalyzeResult | null>(null);
  const [showWhy, setShowWhy] = useState(false);
  const [approving, setApproving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runAnalyze = useCallback(async () => {
    setPhase("analyzing");
    setError(null);
    try {
      const res = await fetch("/api/first-run/analyze", { method: "POST" });
      const data = (await res.json()) as FirstRunAnalyzeResult;
      if (!res.ok) {
        setError("Analysis could not finish. You can retry or open Connections.");
        setPhase("empty");
        return;
      }
      setResult(data);
      setStages(data.stages);
      if (data.decision) {
        setPhase("decision");
      } else {
        setPhase("empty");
      }
    } catch {
      setError("Analysis could not finish. You can retry or open Connections.");
      setPhase("empty");
    }
  }, []);

  useEffect(() => {
    void track("first_run_opened", { installed: Boolean(installed) });
    const timer = window.setTimeout(() => {
      void runAnalyze();
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [installed, runAnalyze]);

  // Progressive stage animation while waiting for analyze
  useEffect(() => {
    if (phase !== "analyzing" && phase !== "welcome") return;
    let i = 1;
    const id = window.setInterval(() => {
      setStages((prev) =>
        prev.map((stage, idx) => {
          if (idx < i) return { ...stage, status: "done" };
          if (idx === i) return { ...stage, status: "active" };
          return stage;
        }),
      );
      i += 1;
      if (i >= WELCOME_STAGES.length) window.clearInterval(id);
    }, 700);
    return () => window.clearInterval(id);
  }, [phase]);

  async function completeFirstRun() {
    await fetch("/api/first-run/complete", { method: "POST" });
  }

  async function handleSeeWhy() {
    setShowWhy(true);
    await track("see_why_clicked", {
      recommendationId: result?.decision?.recommendationId,
    });
  }

  async function handleApprove() {
    if (!result?.decision) return;
    setApproving(true);
    try {
      const res = await fetch("/api/decisions/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recommendationId: result.decision.recommendationId,
          title: result.decision.title,
          action: "approve",
          confidencePct: result.decision.confidencePct,
          expectedImpactLabel: result.decision.expectedImpactLabel,
          source: "first_run",
        }),
      });
      if (!res.ok) {
        setError("Could not record approval. Try again from Approvals.");
        setApproving(false);
        return;
      }
      await completeFirstRun();
      router.push("/approvals?firstRun=1");
    } catch {
      setError("Could not record approval. Try again from Approvals.");
      setApproving(false);
    }
  }

  async function handleReject() {
    if (!result?.decision) {
      await completeFirstRun();
      router.push("/");
      return;
    }
    setApproving(true);
    try {
      await fetch("/api/decisions/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recommendationId: result.decision.recommendationId,
          title: result.decision.title,
          action: "later",
          confidencePct: result.decision.confidencePct,
          expectedImpactLabel: result.decision.expectedImpactLabel,
          source: "first_run",
        }),
      });
      await completeFirstRun();
      router.push("/");
    } catch {
      await completeFirstRun();
      router.push("/");
    }
  }

  async function handleSkipEmpty() {
    await completeFirstRun();
    router.push("/connections?tab=advertising");
  }

  return (
    <div className="first-run-shell">
      <div className="first-run-inner">
        {(phase === "welcome" || phase === "analyzing") && (
          <>
            <header className="first-run-welcome">
              <p className="first-run-eyebrow">Welcome to StorePilot</p>
              <h1>We&apos;re analyzing your business.</h1>
              <p className="first-run-lede">
                This usually takes 1–2 minutes. Today you&apos;ll receive your first executive
                recommendation.
              </p>
            </header>
            <FirstRunProgress stages={stages} />
          </>
        )}

        {phase === "decision" && result?.decision && (
          <>
            <header className="first-run-welcome">
              <p className="first-run-eyebrow">Your briefing is ready</p>
              <h1>One decision worth your attention</h1>
            </header>
            <FirstRunDecisionCard
              decision={result.decision}
              onSeeWhy={() => void handleSeeWhy()}
              onApprove={() => void handleApprove()}
              onReject={() => void handleReject()}
              approving={approving}
            />
            {showWhy ? <FirstRunWhyPanel decision={result.decision} /> : null}
            <FirstRunApprovePreview decision={result.decision} />
          </>
        )}

        {phase === "empty" && (
          <section className="card first-run-empty">
            <h1 style={{ marginTop: 0 }}>Still gathering signal</h1>
            <p>
              {result?.emptyReason ??
                error ??
                "We're still analyzing your store. Connect advertising accounts to unlock more recommendations."}
            </p>
            <div className="first-run-decision-actions">
              <button type="button" className="btn btn-secondary" onClick={() => void runAnalyze()}>
                Retry analysis
              </button>
              <button type="button" className="btn btn-primary" onClick={() => void handleSkipEmpty()}>
                Connect advertising
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  void completeFirstRun().then(() => router.push("/"));
                }}
              >
                Go to Executive
              </button>
            </div>
          </section>
        )}

        {error && phase === "decision" ? (
          <p className="muted" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
