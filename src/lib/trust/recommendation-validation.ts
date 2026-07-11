import type { MarketingPlatformSummary } from "@/lib/analytics/marketing-manager";
import type { OptimizationPackage } from "@/lib/advertising/types";
import type { AdvertisingCampaignRow } from "@/lib/advertising/types";

export type RecommendationValidationIssue = {
  code: string;
  severity: "block" | "warn";
  message: string;
};

export function validateChannelBudgetRecommendation(input: {
  meta: MarketingPlatformSummary;
  google: MarketingPlatformSummary;
  rawRecommendation: string;
  shiftPct: number;
}): { text: string; issues: RecommendationValidationIssue[] } {
  const issues: RecommendationValidationIssue[] = [];
  const metaProfit = input.meta.profit ?? 0;
  const googleProfit = input.google.profit ?? 0;
  const shiftingToGoogle = /shift.*google/i.test(input.rawRecommendation);

  if (shiftingToGoogle && googleProfit < 0 && metaProfit > 0) {
    issues.push({
      code: "channel_shift_unprofitable_target",
      severity: "warn",
      message: "Budget shift targets a channel with negative estimated profit while Meta remains profitable.",
    });
    return {
      text:
        `Google shows stronger ROAS (${input.google.roas.toFixed(2)} vs Meta ${input.meta.roas.toFixed(2)}), but estimated profit is still negative after product costs. ` +
        `Before shifting ~${input.shiftPct || 10}% of budget from Meta, connect product costs and pause unprofitable Google campaigns rather than scaling spend.`,
      issues,
    };
  }

  if (shiftingToGoogle && googleProfit < metaProfit && metaProfit > 0) {
    issues.push({
      code: "channel_shift_lower_profit",
      severity: "warn",
      message: "Budget shift would move spend from a more profitable channel to a less profitable one.",
    });
    return {
      text:
        `Meta is currently more profitable (${formatUsd(metaProfit)} vs Google ${formatUsd(googleProfit)}). ` +
        `Improve Google campaign margins before reallocating budget from Meta.`,
      issues,
    };
  }

  if (shiftingToGoogle && (input.meta.profit == null || input.google.profit == null)) {
    issues.push({
      code: "channel_shift_missing_costs",
      severity: "warn",
      message: "Profit data incomplete — channel shift based on ROAS only.",
    });
    return {
      text:
        `${input.rawRecommendation} Note: product costs are incomplete, so this uses ROAS only. Connect Shopify product costs to verify profit before changing budgets.`,
      issues,
    };
  }

  return { text: input.rawRecommendation, issues };
}

export function validateOptimizationPackage(
  pkg: OptimizationPackage,
  campaign?: AdvertisingCampaignRow,
): OptimizationPackage {
  if (!campaign) return pkg;

  const isScale =
    /increase|scale|shift budget/i.test(pkg.title) ||
    pkg.steps.some((s) => /increase|scale/i.test(s));
  const isPause = /pause|reduce|cut/i.test(pkg.title) || pkg.steps.some((s) => /pause|reduce/i.test(s));

  if (isScale && campaign.profit < 0 && campaign.roas < 1.2 && !isPause) {
    return {
      ...pkg,
      title: `${pkg.campaignName}: stabilize before scaling`,
      steps: [
        "Review product costs and attributed revenue",
        "Pause or reduce spend on unprofitable ad sets",
        ...pkg.steps.filter((s) => !/increase|scale/i.test(s)),
      ].slice(0, 4),
    };
  }

  return pkg;
}

export function validateOptimizationPackages(
  packages: OptimizationPackage[],
  campaigns: AdvertisingCampaignRow[],
): OptimizationPackage[] {
  const byId = new Map(campaigns.map((c) => [c.id, c]));
  return packages.map((pkg) =>
    validateOptimizationPackage(pkg, pkg.campaignId ? byId.get(pkg.campaignId) : undefined),
  );
}

function formatUsd(value: number): string {
  const sign = value < 0 ? "-" : "";
  return `${sign}$${Math.abs(Math.round(value)).toLocaleString()}`;
}
