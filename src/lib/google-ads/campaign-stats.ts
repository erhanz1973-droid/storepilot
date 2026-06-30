export type GoogleCampaignSyncStats = {
  totalCount: number;
  activeCount: number;
  pausedCount: number;
  enabledCount: number;
};

export function emptyGoogleCampaignSyncStats(): GoogleCampaignSyncStats {
  return { totalCount: 0, activeCount: 0, pausedCount: 0, enabledCount: 0 };
}

export function summarizeGoogleCampaigns(
  campaigns: { status: string }[],
): GoogleCampaignSyncStats {
  let activeCount = 0;
  let pausedCount = 0;
  let enabledCount = 0;

  for (const c of campaigns) {
    const status = c.status.toUpperCase();
    if (status === "ENABLED") {
      enabledCount += 1;
      activeCount += 1;
    } else if (status === "PAUSED") {
      pausedCount += 1;
    }
  }

  return {
    totalCount: campaigns.length,
    activeCount,
    pausedCount,
    enabledCount,
  };
}

export function mergeGoogleCampaignSyncStats(
  stats: GoogleCampaignSyncStats[],
): GoogleCampaignSyncStats {
  return stats.reduce(
    (acc, s) => ({
      totalCount: acc.totalCount + s.totalCount,
      activeCount: acc.activeCount + s.activeCount,
      pausedCount: acc.pausedCount + s.pausedCount,
      enabledCount: acc.enabledCount + s.enabledCount,
    }),
    emptyGoogleCampaignSyncStats(),
  );
}
