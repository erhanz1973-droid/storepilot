import type { DecisionItem } from "@/lib/decisions/center";
import type { DecisionCenterView, DecisionMemo } from "@/lib/approvals/decision-center-types";
import type { CampaignEntitlements } from "./types";
import { isCampaignUnlocked } from "./entitlements";

function memoCampaignId(memo: DecisionMemo): string | undefined {
  return memo.card.entityId;
}

export type DecisionMemoWithPlan = DecisionMemo & {
  planLocked?: boolean;
  planLockMessage?: string;
};

function applyMemoLock(
  memo: DecisionMemo,
  entitlements: CampaignEntitlements,
): DecisionMemo & { planLocked?: boolean; planLockMessage?: string } {
  const campaignId = memoCampaignId(memo);
  if (entitlements.isUnlimited || !campaignId) {
    return memo;
  }
  if (isCampaignUnlocked(campaignId, entitlements)) {
    return memo;
  }
  return {
    ...memo,
    planLocked: true,
    planLockMessage: "This recommendation is awaiting an entitlement refresh.",
  };
}

export function filterDecisionsByPlan(
  decisions: DecisionItem[],
  entitlements: CampaignEntitlements,
): { unlocked: DecisionItem[]; locked: DecisionItem[] } {
  if (entitlements.isUnlimited) {
    return { unlocked: decisions, locked: [] };
  }
  const unlocked: DecisionItem[] = [];
  const locked: DecisionItem[] = [];
  for (const d of decisions) {
    if (d.entityType === "campaign" && d.entityId && !isCampaignUnlocked(d.entityId, entitlements)) {
      locked.push(d);
    } else {
      unlocked.push(d);
    }
  }
  return { unlocked, locked };
}

export function applyPlanToDecisionCenter(
  view: DecisionCenterView,
  entitlements: CampaignEntitlements,
): DecisionCenterView & {
  planUsage?: CampaignEntitlements;
  lockedDecisionCount?: number;
  lockedDecisions?: DecisionMemoWithPlan[];
} {
  if (entitlements.isUnlimited) {
    return { ...view, planUsage: entitlements };
  }

  const allDecisions = view.primaryDecision
    ? [view.primaryDecision, ...view.additionalDecisions]
    : view.additionalDecisions;

  const processed = allDecisions.map((m) => applyMemoLock(m, entitlements));
  const unlockedMemos = processed.filter((m) => !m.planLocked);
  const lockedMemos = processed.filter((m) => m.planLocked);

  return {
    ...view,
    planUsage: entitlements,
    lockedDecisionCount: lockedMemos.length,
    lockedDecisions: lockedMemos,
    primaryDecision: unlockedMemos[0] ?? null,
    additionalDecisions: unlockedMemos.slice(1),
    briefing: {
      ...view.briefing,
      narrative:
        lockedMemos.length > 0
          ? `${view.briefing.narrative} ${lockedMemos.length} recommendation${lockedMemos.length === 1 ? "" : "s"} awaiting an entitlement refresh.`
          : view.briefing.narrative,
    },
  };
}
