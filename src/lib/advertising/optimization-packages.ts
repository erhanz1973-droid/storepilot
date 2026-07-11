import type { OptimizationRecommendation, OptimizationPackage } from "./types";
import type { ActionRiskLevel } from "@/lib/attribution/decision-engine-types";

function maxRisk(levels: ActionRiskLevel[]): ActionRiskLevel {
  if (levels.includes("High")) return "High";
  if (levels.includes("Medium")) return "Medium";
  return "Low";
}

function normalizeStep(title: string): string {
  const lower = title.toLowerCase();
  if (lower.includes("creative") || lower.includes("refresh")) return "Refresh Creatives";
  if (lower.includes("overlap") || lower.includes("audience")) return "Audience Cleanup";
  if (lower.includes("pause") || lower.includes("ad set")) return "Pause weak Ad Sets";
  if (lower.includes("reduce") && lower.includes("budget")) return "Reduce Budget";
  if (lower.includes("increase") || lower.includes("scale")) return "Increase Budget";
  if (lower.includes("shift") || lower.includes("reallocat")) return "Shift Budget";
  if (lower.includes("landing")) return "Fix Landing Page";
  return title.length > 40 ? `${title.slice(0, 37)}…` : title;
}

function dedupeSteps(steps: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of steps) {
    if (!seen.has(s)) {
      seen.add(s);
      out.push(s);
    }
  }
  return out;
}

export function buildOptimizationPackages(
  recommendations: OptimizationRecommendation[],
): OptimizationPackage[] {
  const byCampaign = new Map<string, OptimizationRecommendation[]>();
  const crossCampaign: OptimizationRecommendation[] = [];

  for (const rec of recommendations) {
    if (!rec.campaignId) {
      crossCampaign.push(rec);
      continue;
    }
    const list = byCampaign.get(rec.campaignId) ?? [];
    list.push(rec);
    byCampaign.set(rec.campaignId, list);
  }

  const packages: OptimizationPackage[] = [];
  let rank = 1;

  for (const [campaignId, group] of byCampaign) {
    const campaignName = group[0]?.campaignName ?? "Campaign";
    const steps = dedupeSteps(group.map((g) => normalizeStep(g.title)));
    const enrichedSteps = enrichPackageSteps(steps, group[0]?.title ?? "");

    if (group.length >= 2 || enrichedSteps.length >= 2) {
      const totalProfit = Math.round(
        group.reduce((s, g) => s + g.expectedProfitMonthly, 0) *
          (group.length >= 2 ? 0.82 : 1),
      );
      const avgConf = Math.round(
        group.reduce((s, g) => s + g.confidencePct, 0) / group.length,
      );
      packages.push({
        id: `pkg-${campaignId}`,
        rank: rank++,
        campaignId,
        campaignName,
        title: `${campaignName} Optimization`,
        steps: enrichedSteps,
        expectedProfitMonthly: totalProfit || group[0]!.expectedProfitMonthly,
        confidencePct: Math.min(95, avgConf + 4),
        risk: maxRisk(group.map((g) => g.risk)),
        estimatedTime: "7 days",
        rollbackAvailable: group.some((g) => g.rollbackAvailable),
        approvalStatus: group.some((g) => g.approvalStatus === "pending")
          ? "pending"
          : group.some((g) => g.approvalStatus === "approved")
            ? "approved"
            : "none",
        decisionId: group.find((g) => g.decisionId)?.decisionId,
        isPackage: true,
      });
    } else {
      const single = group[0]!;
      packages.push({
        id: single.id,
        rank: rank++,
        campaignId,
        campaignName,
        title: single.title,
        steps: [normalizeStep(single.title)],
        expectedProfitMonthly: single.expectedProfitMonthly,
        confidencePct: single.confidencePct,
        risk: single.risk,
        estimatedTime: single.estimatedTime,
        rollbackAvailable: single.rollbackAvailable,
        approvalStatus: single.approvalStatus,
        decisionId: single.decisionId,
        isPackage: false,
      });
    }
  }

  for (const rec of crossCampaign) {
    packages.push({
      id: rec.id,
      rank: rank++,
      campaignName: rec.campaignName,
      title: rec.title,
      steps: [normalizeStep(rec.title)],
      expectedProfitMonthly: rec.expectedProfitMonthly,
      confidencePct: rec.confidencePct,
      risk: rec.risk,
      estimatedTime: rec.estimatedTime,
      rollbackAvailable: rec.rollbackAvailable,
      approvalStatus: rec.approvalStatus,
      decisionId: rec.decisionId,
      isPackage: false,
    });
  }

  return packages.sort((a, b) => b.expectedProfitMonthly - a.expectedProfitMonthly);
}

function enrichPackageSteps(steps: string[], primaryTitle: string): string[] {
  const lower = primaryTitle.toLowerCase();
  const companions: string[] = [...steps];
  if (!companions.includes("Refresh Creatives") && (lower.includes("creative") || lower.includes("broad") || lower.includes("prospect"))) {
    companions.push("Refresh Creatives");
  }
  if (!companions.includes("Audience Cleanup") && (lower.includes("overlap") || lower.includes("audience") || lower.includes("broad"))) {
    companions.push("Audience Cleanup");
  }
  if (!companions.includes("Pause weak Ad Sets") && (lower.includes("pause") || lower.includes("weak") || lower.includes("ad set"))) {
    companions.push("Pause weak Ad Sets");
  }
  if (
    !companions.includes("Reduce Budget") &&
    !companions.includes("Increase Budget") &&
    (lower.includes("budget") || lower.includes("reduce") || lower.includes("shift"))
  ) {
    companions.push("Reduce Budget");
  }
  if (companions.length < 2) {
    companions.push("Refresh Creatives", "Audience Cleanup");
  }
  return dedupeSteps(companions).slice(0, 5);
}
