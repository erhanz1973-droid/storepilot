import type { MetaCampaign } from "@/lib/connectors/types";
import type { Recommendation } from "@/lib/types";
import type { CampaignMetaDetailsView } from "@/lib/meta/campaign-details";
import { buildCampaignMetaDetails } from "@/lib/meta/campaign-details";
import { classifyCampaignObjective } from "@/lib/meta/campaign-objectives";
import { evaluateCampaignByObjective, campaignHasMeasurableSpend, MIN_CAMPAIGN_REVIEW_SPEND } from "./campaign-evaluation";

export { campaignHasMeasurableSpend, MIN_CAMPAIGN_REVIEW_SPEND };

export function campaignNeedsReview(campaign: MetaCampaign): boolean {
  return evaluateCampaignByObjective(campaign).needsReview;
}

export function formatCampaignReviewImpact(campaign: MetaCampaign): string {
  const evaluation = evaluateCampaignByObjective(campaign);

  if (evaluation.recommendedAction && evaluation.needsReview) {
    return evaluation.recommendedAction;
  }

  const recovery = campaignWeeklyRecoveryRange(campaign.spend7d);
  const objective = classifyCampaignObjective(campaign);

  if (recovery && (objective === "sales" || objective === "leads" || objective === "traffic")) {
    return `Reviewing targeting, creative, or budget allocation could recover $${recovery.low}–$${recovery.high} in weekly ad efficiency.`;
  }
  if (campaign.spend7d < MIN_CAMPAIGN_REVIEW_SPEND) {
    return `7-day spend is $${campaign.spend7d.toLocaleString()} — too low for a reliable ${evaluation.objectiveLabel.toLowerCase()} benchmark.`;
  }
  return evaluation.recommendedAction;
}

export function campaignWeeklyRecoveryRange(spend7d: number): {
  low: number;
  high: number;
} | null {
  const low = Math.round(spend7d * 0.2);
  const high = Math.round(spend7d * 0.35);
  if (high < 1) return null;
  return { low: Math.max(1, low), high };
}

const CAMPAIGN_TITLE_PREFIXES = [
  "Campaign Needs Review — ",
  "Pause campaign — ",
  "Reduce budget — ",
  "Scale campaign — ",
  "Increase budget — ",
];

export function extractCampaignNameFromTitle(title: string): string | null {
  for (const prefix of CAMPAIGN_TITLE_PREFIXES) {
    if (title.startsWith(prefix)) {
      return title.slice(prefix.length).trim();
    }
  }
  return null;
}

/** Index campaigns by full id, Meta numeric id suffix, and exact name. */
export function buildCampaignLookup(campaigns: MetaCampaign[]): Map<string, MetaCampaign> {
  const lookup = new Map<string, MetaCampaign>();

  for (const campaign of campaigns) {
    lookup.set(campaign.id, campaign);

    const suffix = campaign.id.includes(":") ? campaign.id.split(":").pop()! : campaign.id;
    if (!lookup.has(suffix)) {
      lookup.set(suffix, campaign);
    }

    const dedupeKey = `camp-${campaign.id}`;
    if (!lookup.has(dedupeKey)) {
      lookup.set(dedupeKey, campaign);
    }

    const normalizedName = normalizeCampaignNameKey(campaign.name);
    if (!lookup.has(`name:${normalizedName}`)) {
      lookup.set(`name:${normalizedName}`, campaign);
    }
  }

  return lookup;
}

export function resolveCampaignFromSnapshot(
  campaigns: MetaCampaign[],
  keys: { entityId?: string; title?: string },
): MetaCampaign | undefined {
  const lookup = buildCampaignLookup(campaigns);

  if (keys.entityId) {
    const direct = lookup.get(keys.entityId);
    if (direct) return direct;

    if (keys.entityId.startsWith("camp-")) {
      const withoutPrefix = keys.entityId.slice(5);
      const byPrefixed = lookup.get(withoutPrefix) ?? lookup.get(keys.entityId);
      if (byPrefixed) return byPrefixed;
    }

    const suffix = keys.entityId.includes(":") ? keys.entityId.split(":").pop()! : keys.entityId;
    const bySuffix = lookup.get(suffix);
    if (bySuffix) return bySuffix;
  }

  const nameFromTitle = keys.title ? extractCampaignNameFromTitle(keys.title) : null;
  if (nameFromTitle) {
    const byName = lookup.get(`name:${normalizeCampaignNameKey(nameFromTitle)}`);
    if (byName) return byName;
  }

  return undefined;
}

function statusFromStoredEvidence(recommendation?: Recommendation): string | undefined {
  const metrics = recommendation?.supportingMetrics ?? [];
  const statusMetric = metrics.find((m) => m.label === "Durum" || m.label === "Status");
  return statusMetric?.value?.trim() || undefined;
}

export function campaignDetailsFromEvidence(
  recommendation?: Recommendation,
): CampaignMetaDetailsView | undefined {
  const metrics = recommendation?.supportingMetrics ?? [];
  const get = (label: string) => metrics.find((m) => m.label === label)?.value;
  const status = get("Durum") ?? get("Status");
  const objective = get("Hedef");
  const budget = get("Günlük bütçe");
  const duration = get("Süre");
  if (!status && !objective && !budget && !duration) return undefined;
  return {
    statusLabel: status ?? "Bilinmiyor",
    objectiveLabel: objective ?? "Belirtilmemiş",
    dailyBudgetLabel: budget ?? "Belirtilmemiş",
    durationLabel: duration ?? "Belirtilmemiş",
  };
}

export function resolveHistoryCampaignStatus(
  campaigns: MetaCampaign[],
  keys: { entityId?: string; title?: string },
  recommendation?: Recommendation,
): { campaignStatus?: string; campaignStatusLabel: string } {
  const campaign = resolveCampaignFromSnapshot(campaigns, keys);

  if (campaign) {
    const raw = campaign.metaEffectiveStatus ?? campaign.effectiveStatus;
    return {
      campaignStatus: raw,
      campaignStatusLabel: formatMetaEffectiveStatusLabel(raw),
    };
  }

  const fromEvidence = statusFromStoredEvidence(recommendation);
  if (fromEvidence) {
    return { campaignStatusLabel: fromEvidence };
  }

  return { campaignStatusLabel: "Not in sync" };
}

import {
  formatMetaEffectiveStatusLabel,
  isMetaCampaignActive,
  isMetaCampaignPaused,
  normalizeCampaignNameKey,
} from "@/lib/meta/campaign-status";

export { buildCampaignMetaDetails };
