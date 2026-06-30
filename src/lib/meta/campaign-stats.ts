import type { MetaCampaign, MetaCampaignEffectiveStatus } from "@/lib/connectors/types";

export type MetaCampaignSyncStats = {
  totalCount: number;
  activeCount: number;
  draftCount: number;
  pausedCount: number;
  archivedCount: number;
  deletedCount: number;
};

export function normalizeEffectiveStatus(raw: string): MetaCampaignEffectiveStatus {
  const value = raw.toUpperCase();
  if (value === "ACTIVE") return "ACTIVE";
  if (value === "PAUSED" || value === "CAMPAIGN_PAUSED" || value === "ADSET_PAUSED") {
    return "PAUSED";
  }
  if (value === "ARCHIVED") return "ARCHIVED";
  if (value === "DELETED") return "DELETED";
  if (
    value === "IN_PROCESS" ||
    value === "PENDING_REVIEW" ||
    value === "PREAPPROVED" ||
    value === "DRAFT"
  ) {
    return "DRAFT";
  }
  return "PAUSED";
}

export function isAnalyzableCampaign(campaign: MetaCampaign): boolean {
  return campaign.effectiveStatus === "ACTIVE";
}

export function summarizeCampaigns(campaigns: MetaCampaign[]): MetaCampaignSyncStats {
  const stats: MetaCampaignSyncStats = {
    totalCount: campaigns.length,
    activeCount: 0,
    draftCount: 0,
    pausedCount: 0,
    archivedCount: 0,
    deletedCount: 0,
  };

  for (const campaign of campaigns) {
    switch (campaign.effectiveStatus) {
      case "ACTIVE":
        stats.activeCount += 1;
        break;
      case "DRAFT":
        stats.draftCount += 1;
        break;
      case "PAUSED":
        stats.pausedCount += 1;
        break;
      case "ARCHIVED":
        stats.archivedCount += 1;
        break;
      case "DELETED":
        stats.deletedCount += 1;
        break;
    }
  }

  return stats;
}

export function getActiveCampaigns(campaigns: MetaCampaign[]): MetaCampaign[] {
  return campaigns.filter(isAnalyzableCampaign);
}

export function countActiveCampaigns(campaigns: MetaCampaign[]): number {
  return getActiveCampaigns(campaigns).length;
}

export function emptyCampaignSyncStats(): MetaCampaignSyncStats {
  return {
    totalCount: 0,
    activeCount: 0,
    draftCount: 0,
    pausedCount: 0,
    archivedCount: 0,
    deletedCount: 0,
  };
}

export function mergeCampaignSyncStats(
  accounts: MetaCampaignSyncStats[],
): MetaCampaignSyncStats {
  return accounts.reduce(
    (acc, stats) => ({
      totalCount: acc.totalCount + stats.totalCount,
      activeCount: acc.activeCount + stats.activeCount,
      draftCount: acc.draftCount + stats.draftCount,
      pausedCount: acc.pausedCount + stats.pausedCount,
      archivedCount: acc.archivedCount + stats.archivedCount,
      deletedCount: acc.deletedCount + stats.deletedCount,
    }),
    emptyCampaignSyncStats(),
  );
}
