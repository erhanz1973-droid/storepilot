import type { ActionRiskLevel } from "./decision-engine-types";
import type { UnrankedStrategyAction } from "./action-priority";
import type { CampaignAttributionRow } from "./models";

const PACKAGE_PREFIXES = [
  "reduce-prospect-",
  "refresh-retarget-",
  "pause-adsets-",
  "optimize-before-pause-",
  "trim-",
  "landing-",
] as const;

const STANDALONE_IDS = new Set([
  "reduce-overlap",
  "shift-meta-to-google",
]);

function extractCampaignId(actionId: string): string | null {
  if (STANDALONE_IDS.has(actionId) || actionId.startsWith("reallocate-")) return null;
  if (actionId.startsWith("pause-") && !actionId.startsWith("pause-adsets-")) {
    return actionId.slice("pause-".length);
  }
  for (const prefix of PACKAGE_PREFIXES) {
    if (actionId.startsWith(prefix)) return actionId.slice(prefix.length);
  }
  return null;
}

function campaignNameForId(
  campaignId: string,
  campaigns: CampaignAttributionRow[],
): string {
  return campaigns.find((c) => c.campaignId === campaignId)?.campaignName ?? "Campaign";
}

function maxRisk(levels: ActionRiskLevel[]): ActionRiskLevel {
  if (levels.includes("High")) return "High";
  if (levels.includes("Medium")) return "Medium";
  return "Low";
}

export function consolidateCampaignActions(
  actions: UnrankedStrategyAction[],
  campaigns: CampaignAttributionRow[],
): UnrankedStrategyAction[] {
  const grouped = new Map<string, UnrankedStrategyAction[]>();
  const standalone: UnrankedStrategyAction[] = [];

  for (const action of actions) {
    const campaignId = extractCampaignId(action.id);
    if (!campaignId) {
      standalone.push(action);
      continue;
    }
    const list = grouped.get(campaignId) ?? [];
    list.push(action);
    grouped.set(campaignId, list);
  }

  const packages: UnrankedStrategyAction[] = [];

  for (const [campaignId, group] of grouped) {
    if (group.length < 2) {
      standalone.push(...group);
      continue;
    }

    const name = campaignNameForId(campaignId, campaigns);
    const totalImprovement = Math.round(
      group.reduce((s, a) => s + a.estimatedMonthlyImprovement, 0) * 0.82,
    );
    const avgConfidence = Math.round(
      group.reduce((s, a) => s + a.confidencePct, 0) / group.length,
    );
    const revenueImpact = Math.round(
      group.reduce((s, a) => s + a.expectedRevenueImpactPct, 0) / group.length,
    );

    packages.push({
      id: `package-${campaignId}`,
      title: `${name} Optimization`,
      description: `Consolidated optimization package — ${group.length} coordinated actions instead of separate recommendations.`,
      reason: group.map((a) => a.reason).filter(Boolean).slice(0, 2).join(" "),
      estimatedMonthlyImprovement: totalImprovement,
      confidencePct: Math.min(95, avgConfidence + 4),
      riskLevel: maxRisk(group.map((a) => a.riskLevel)),
      expectedRevenueImpactPct: revenueImpact,
      cashFlowImpact: group.some((a) => a.cashFlowImpact === "Positive")
        ? "Positive"
        : "Neutral",
      isLastResort: group.every((a) => a.isLastResort),
      isPackage: true,
      packageSteps: group.map((a) => a.title.replace(name, "").trim() || a.title),
      implementationTime: "7–14 days",
      rollbackAvailable: true,
    });
  }

  return [...packages, ...standalone];
}
