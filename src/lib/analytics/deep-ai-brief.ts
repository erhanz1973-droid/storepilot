/**
 * Deep AI discovers opportunities.
 * Executive Mode decides whether they justify CEO attention.
 * These modules must never contradict each other in copy.
 */

import type { ExecutiveThresholdPeek } from "@/lib/analytics/executive-decision-ranking";
import { EXECUTIVE_ACTION_THRESHOLD_PCT } from "@/lib/analytics/executive-decision-ranking";

/** Mirrored from CEO OS — avoid circular import with build-executive-ceo-os */
export type DeepAiAlignedMode = "NO_ACTION" | "OBSERVE" | "ACTION_REQUIRED" | "CRITICAL";

export type DeepAiExecutiveBrief = {
  mode: DeepAiAlignedMode;
  campaignsScanned: number;
  potentialOpportunities: number;
  executiveCandidates: number;
  observingCampaignName: string | null;
  /** Short headline aligned with Executive Mode */
  headline: string;
  /** One coherent paragraph — Analysis vs Action */
  summary: string;
  /** Why no / not-yet executive action */
  whyNoAction: string | null;
  threshold: {
    currentScore: number;
    requiredScore: number;
    highestTitle: string | null;
    message: string;
  } | null;
  upgrade: {
    planLabel: string;
    ctaLabel: string;
    footnote: string;
  } | null;
};

export function buildDeepAiExecutiveBrief(input: {
  mode: DeepAiAlignedMode;
  campaignsScanned: number;
  potentialOpportunities: number;
  executiveCandidates: number;
  observingCampaignName?: string | null;
  thresholdPeek?: ExecutiveThresholdPeek | null;
  hasDecisionAction?: string | null;
  upgradePlanLabel?: string | null;
  isUnlimited?: boolean;
}): DeepAiExecutiveBrief {
  const scanned = Math.max(0, input.campaignsScanned);
  const opps = Math.max(0, input.potentialOpportunities);
  const exec = Math.max(0, input.executiveCandidates);
  const observing = input.observingCampaignName?.trim() || null;

  const threshold =
    input.mode === "NO_ACTION" || input.mode === "OBSERVE"
      ? {
          currentScore: input.thresholdPeek?.readinessPct ?? 0,
          requiredScore: input.thresholdPeek?.requiredPct ?? EXECUTIVE_ACTION_THRESHOLD_PCT,
          highestTitle: input.thresholdPeek?.title ?? null,
          message: input.thresholdPeek
            ? `Highest opportunity reviewed: ${input.thresholdPeek.title}. Evidence is not yet strong enough to recommend executive action.`
            : "No opportunity currently clears the Executive Action Threshold.",
        }
      : null;

  let headline: string;
  let summary: string;
  let whyNoAction: string | null = null;

  if (input.mode === "ACTION_REQUIRED" || input.mode === "CRITICAL") {
    headline =
      input.mode === "CRITICAL"
        ? "Confidence threshold exceeded — critical executive action"
        : "Confidence threshold exceeded — executive action recommended";
    summary = `${scanned} campaigns scanned. ${opps} optimization ${
      opps === 1 ? "opportunity" : "opportunities"
    } identified. ${exec} cleared the Executive Action Threshold${
      input.hasDecisionAction ? `: ${input.hasDecisionAction}` : ""
    }.`;
  } else if (input.mode === "OBSERVE") {
    headline = "Building Evidence — opportunities identified";
    summary = `${scanned} campaigns scanned. ${opps} optimization ${
      opps === 1 ? "opportunity" : "opportunities"
    } identified, but none currently exceed the Executive Decision Threshold${
      observing ? ` (${observing})` : ""
    }.`;
    whyNoAction = `${scanned} campaigns analyzed. ${opps} optimization ${
      opps === 1 ? "opportunity" : "opportunities"
    } detected. None currently exceed the Executive Action Threshold (${
      threshold?.currentScore ?? 0
    }/${threshold?.requiredScore ?? EXECUTIVE_ACTION_THRESHOLD_PCT}). StorePilot is validating additional business evidence before escalating a recommendation.`;
  } else {
    headline = "No material issues detected";
    summary = `${scanned} campaigns scanned. No significant opportunities requiring executive attention.`;
    whyNoAction =
      opps > 0
        ? whyNoActionForSparseOpps(scanned, opps, threshold)
        : `${scanned} campaigns scanned. No material issues detected. No executive action required.`;
  }

  const upgrade =
    !input.isUnlimited && input.upgradePlanLabel
      ? {
          planLabel: input.upgradePlanLabel,
          ctaLabel: `Upgrade to ${input.upgradePlanLabel}`,
          footnote: `Unlock Deep AI reasoning for all ${scanned || ""} campaigns.`.replace(
            /\s+/g,
            " ",
          ).trim(),
        }
      : null;

  return {
    mode: input.mode,
    campaignsScanned: scanned,
    potentialOpportunities: opps,
    executiveCandidates: exec,
    observingCampaignName: observing,
    headline,
    summary,
    whyNoAction,
    threshold,
    upgrade,
  };
}

function whyNoActionForSparseOpps(
  scanned: number,
  opps: number,
  threshold: DeepAiExecutiveBrief["threshold"],
): string {
  return `${scanned} campaigns analyzed. ${opps} weak signal${
    opps === 1 ? "" : "s"
  } noted. None exceed the Executive Action Threshold${
    threshold ? ` (${threshold.currentScore}/${threshold.requiredScore})` : ""
  }.`;
}
