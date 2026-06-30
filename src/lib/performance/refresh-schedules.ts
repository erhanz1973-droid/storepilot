/** Client refresh intervals — tiered by how often data actually changes. */
export const REFRESH_MS = {
  liveKpis: 30_000,
  liveFull: 5 * 60_000,
  aiInsights: 5 * 60_000,
  inventory: 10 * 60_000,
} as const;
