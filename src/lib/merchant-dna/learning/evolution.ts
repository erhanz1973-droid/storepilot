import type { DecisionRejectionReason } from "@/lib/decisions/engine/types";
import type { Recommendation } from "@/lib/types";
import type { MerchantDNALearnedSignals, MerchantPersonality } from "../types";

export type LearningInput = {
  rejections: { reason: DecisionRejectionReason; createdAt: string }[];
  recommendations: Recommendation[];
};

export function evolveLearnedSignals(
  previous: MerchantDNALearnedSignals,
  input: LearningInput,
): MerchantDNALearnedSignals {
  const tooAggressive = input.rejections.filter((r) => r.reason === "too_aggressive").length;
  const businessPref = input.rejections.filter((r) => r.reason === "business_preference").length;
  const totalRejections = input.rejections.length;

  const approved = input.recommendations.filter(
    (r) => r.status === "approved" || r.status === "implemented" || r.status === "completed",
  );
  const scalingApprovals = approved.filter((r) =>
    /scale|budget|campaign|roas/i.test(`${r.title} ${r.reason}`),
  ).length;
  const clearanceApprovals = approved.filter((r) =>
    /clearance|inventory|discount|slow/i.test(`${r.title} ${r.reason}`),
  ).length;
  const discountApprovals = approved.filter((r) =>
    /discount|promotion|price/i.test(`${r.title} ${r.reason}`),
  ).length;

  const totalActions = approved.length + totalRejections;
  const approvalRate = totalActions > 0 ? approved.length / totalActions : undefined;
  const rejectionRate = totalActions > 0 ? totalRejections / totalActions : undefined;

  let aggressivenessBias = previous.aggressivenessBias;
  let scalingAffinity = previous.scalingAffinity;
  let discountAffinity = previous.discountAffinity;
  let inventoryClearanceAffinity = previous.inventoryClearanceAffinity;

  if (tooAggressive >= 2) aggressivenessBias = Math.max(-1, aggressivenessBias - 0.15 * tooAggressive);
  if (scalingApprovals >= 2) scalingAffinity = Math.min(1, scalingAffinity + 0.1 * scalingApprovals);
  if (clearanceApprovals >= 2) {
    inventoryClearanceAffinity = Math.min(1, inventoryClearanceAffinity + 0.1);
  }
  if (discountApprovals >= 2) discountAffinity = Math.min(1, discountAffinity + 0.08);

  if (businessPref >= 2) aggressivenessBias = Math.max(-1, aggressivenessBias - 0.05);

  return {
    aggressivenessBias: clamp(round2(aggressivenessBias)),
    scalingAffinity: clamp(round2(scalingAffinity)),
    discountAffinity: clamp(round2(discountAffinity)),
    inventoryClearanceAffinity: clamp(round2(inventoryClearanceAffinity)),
    approvalRate: approvalRate != null ? round2(approvalRate) : previous.approvalRate,
    rejectionRate: rejectionRate != null ? round2(rejectionRate) : previous.rejectionRate,
    tooAggressiveRejections: tooAggressive,
    scalingApprovals,
  };
}

export function personalityFromLearned(
  base: MerchantPersonality,
  learned: MerchantDNALearnedSignals,
): MerchantPersonality {
  if (learned.aggressivenessBias <= -0.25 || (learned.tooAggressiveRejections ?? 0) >= 3) {
    return "conservative";
  }
  if (learned.scalingAffinity >= 0.35 && learned.aggressivenessBias >= 0.1) {
    return "aggressive";
  }
  if (base !== "balanced") return base;
  return "balanced";
}

function clamp(n: number): number {
  return Math.max(-1, Math.min(1, n));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export const DEFAULT_LEARNED_SIGNALS: MerchantDNALearnedSignals = {
  aggressivenessBias: 0,
  scalingAffinity: 0,
  discountAffinity: 0,
  inventoryClearanceAffinity: 0,
};
