/** Client refresh intervals — tiered by how often data actually changes. */
export const REFRESH_MS = {
  liveKpis: 30_000,
  liveFull: 5 * 60_000,
  aiInsights: 5 * 60_000,
  inventory: 10 * 60_000,
  /** Executive dashboard snapshot — avoids recomputing AI on every navigation. */
  executiveDashboard: 45_000,
  /** Dashboard read path — health, decisions, opportunities. */
  dashboardRead: 60_000,
} as const;
