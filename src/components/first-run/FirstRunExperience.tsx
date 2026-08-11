"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { FirstRunApprovePreview } from "@/components/first-run/FirstRunApprovePreview";
import { FirstRunDecisionCard } from "@/components/first-run/FirstRunDecisionCard";
import { FirstRunErrorCard } from "@/components/first-run/FirstRunErrorCard";
import { FirstRunLowDataCard } from "@/components/first-run/FirstRunLowDataCard";
import { FirstRunProgress } from "@/components/first-run/FirstRunProgress";
import { FirstRunWhyPanel } from "@/components/first-run/FirstRunWhyPanel";
import { ACTIVATION_EVENTS, activationTrackPayload } from "@/lib/analytics/activation-events";
import { resolveFirstRunPhase } from "@/lib/first-run/types";
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
  const [analyzing, setAnalyzing] = useState(true);
  const [stages, setStages] = useState<FirstRunStage[]>(WELCOME_STAGES);
  const [result, setResult] = useState<FirstRunAnalyzeResult | null>(null);
  const [showWhy, setShowWhy] = useState(false);
  const [approving, setApproving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const phase = resolveFirstRunPhase({ result, error, analyzing });

  const runAnalyze = useCallback(async () => {
    setAnalyzing(true);
    setError(null);
    try {
      const res = await fetch("/api/first-run/analyze", { method: "POST" });
      const data = (await res.json()) as FirstRunAnalyzeResult;
      if (!res.ok || data.ok === false) {
        setError(
          data.emptyReason ?? "Analysis could not finish. You can retry or open Connections.",
        );
        setResult(data.ok === false ? data : null);
        setAnalyzing(false);
        return;
      }
      setResult(data);
      setStages(data.stages);
      setAnalyzing(false);
    } catch {
      setError("Analysis could not finish. You can retry or open Connections.");
      setAnalyzing(false);
    }
  }, []);

  useEffect(() => {
    const opened = activationTrackPayload({ source: "first_run" });
    void track(ACTIVATION_EVENTS.firstRunOpened, { ...opened, installed: Boolean(installed) });
    void track(ACTIVATION_EVENTS.firstRunStarted, { ...opened, installed: Boolean(installed) });
    const timer = window.setTimeout(() => {
      void runAnalyze();
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [installed, runAnalyze]);

  useEffect(() => {
    if (!result?.decision) return;
    void track(
      ACTIVATION_EVENTS.recommendationViewed,
      activationTrackPayload({
        source: "first_run",
        recommendationId: result.decision.recommendationId,
        recommendationType: result.decision.recommendationType,
      }),
    );
  }, [result?.decision]);

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

  async function trackRecommendationClicked() {
    if (!result?.decision) return;
    const props = activationTrackPayload({
      source: "first_run",
      recommendationId: result.decision.recommendationId,
      recommendationType: result.decision.recommendationType,
    });
    await track(ACTIVATION_EVENTS.firstRecommendationClicked, props);
    await track(ACTIVATION_EVENTS.recommendationClicked, props);
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
      await trackRecommendationClicked();
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

  async function handlePrimaryInsight() {
    await trackRecommendationClicked();
    await completeFirstRun();
    router.push(result?.decision?.primaryCta.href ?? "/");
  }

  async function handleLowDataPrimary() {
    await track("next_best_action_clicked", {
      source: "first_run",
      href: result?.firstValue?.primaryAction.href,
    });
    await completeFirstRun();
    router.push(result?.firstValue?.primaryAction.href ?? "/connections?tab=advertising");
  }

  async function handleLowDataGrow() {
    await completeFirstRun();
    router.push("/");
  }

  return (
    <div className="first-run-shell">
      <div className="first-run-inner">
        {(phase === "welcome" || phase === "analyzing") && (
          <>
            <header className="first-run-welcome">
              <p className="first-run-eyebrow">Welcome to StorePilot</p>
              <h1>We&apos;re analyzing your store.</h1>
              <p className="first-run-lede">
                This usually takes 1–2 minutes. Today you&apos;ll receive your first AI
                recommendation from your live Shopify data.
              </p>
            </header>
            <FirstRunProgress stages={stages} />
          </>
        )}

        {phase === "decision" && result?.decision && (
          <>
            <header className="first-run-welcome">
              <p className="first-run-eyebrow">Your first AI recommendation</p>
              <h1>StorePilot found something useful in your store.</h1>
            </header>
            <FirstRunDecisionCard
              decision={result.decision}
              onSeeWhy={() => void handleSeeWhy()}
              onApprove={() => void handleApprove()}
              onReject={() => void handleReject()}
              onPrimary={() => void handlePrimaryInsight()}
              approving={approving}
            />
            {showWhy || result.decision.presentation === "first_insight" ? (
              <FirstRunWhyPanel decision={result.decision} />
            ) : null}
            {result.decision.presentation === "executive_decision" ? (
              <FirstRunApprovePreview decision={result.decision} />
            ) : null}
          </>
        )}

        {phase === "low_data" && result?.firstValue && (
          <FirstRunLowDataCard
            firstValue={result.firstValue}
            onPrimary={() => void handleLowDataPrimary()}
            onGrow={() => void handleLowDataGrow()}
          />
        )}

        {phase === "error" && (
          <FirstRunErrorCard
            message={
              error ??
              result?.emptyReason ??
              "Analysis could not finish. Retry, or open Connections."
            }
            onRetry={() => void runAnalyze()}
            onConnections={() => router.push("/connections")}
          />
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
