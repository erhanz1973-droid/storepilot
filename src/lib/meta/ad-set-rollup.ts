export type MetaAdSetInput = {
  id: string;
  campaign_id?: string;
  effective_status?: string;
  daily_budget?: string;
  lifetime_budget?: string;
  destination_type?: string;
  optimization_goal?: string;
  start_time?: string;
  end_time?: string;
};

export type AdSetRollup = {
  dailyBudgetCents?: number;
  lifetimeBudgetCents?: number;
  destinationType?: string;
  optimizationGoal?: string;
  startTime?: string;
  endTime?: string;
};

const INACTIVE_ADSET_STATUSES = new Set([
  "ARCHIVED",
  "DELETED",
  "PAUSED",
  "ADSET_PAUSED",
  "CAMPAIGN_PAUSED",
]);

export function isInactiveAdSetStatus(status?: string | null): boolean {
  if (!status) return false;
  return INACTIVE_ADSET_STATUSES.has(status.toUpperCase());
}

export function isActiveAdSetStatus(status?: string | null): boolean {
  return (status ?? "").toUpperCase() === "ACTIVE";
}

function parseBudgetCents(raw?: string): number {
  if (!raw) return 0;
  const value = parseInt(raw, 10);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function scheduleDurationMs(start?: string, end?: string): number {
  if (!start || !end) return 0;
  const startMs = new Date(start).getTime();
  const endMs = new Date(end).getTime();
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs <= startMs) return 0;
  return endMs - startMs;
}

function pickScheduleAdSet(adSets: MetaAdSetInput[]): MetaAdSetInput | undefined {
  const withSchedule = adSets
    .filter((row) => row.start_time && row.end_time)
    .sort((a, b) => scheduleDurationMs(b.start_time, b.end_time) - scheduleDurationMs(a.start_time, a.end_time));

  if (withSchedule.length > 0) return withSchedule[0];

  return adSets.find((row) => row.end_time) ?? adSets[0];
}

function sumBudgets(adSets: MetaAdSetInput[]): { daily: number; lifetime: number } {
  let daily = 0;
  let lifetime = 0;
  for (const row of adSets) {
    daily += parseBudgetCents(row.daily_budget);
    lifetime += parseBudgetCents(row.lifetime_budget);
  }
  return { daily, lifetime };
}

export function rollupAdSetsForCampaign(adSets: MetaAdSetInput[]): AdSetRollup | undefined {
  if (adSets.length === 0) return undefined;

  const active = adSets.filter((row) => isActiveAdSetStatus(row.effective_status));
  const eligible = adSets.filter((row) => !isInactiveAdSetStatus(row.effective_status));
  const budgetPool = active.length > 0 ? active : eligible.length > 0 ? eligible : adSets;
  const schedulePool = active.length > 0 ? active : eligible.length > 0 ? eligible : adSets;

  const budgets = sumBudgets(budgetPool);
  const scheduleSource = pickScheduleAdSet(schedulePool);

  const destinationSource =
    scheduleSource ??
    budgetPool.find((row) => row.destination_type || row.optimization_goal) ??
    budgetPool[0];

  return {
    dailyBudgetCents: budgets.daily > 0 ? budgets.daily : undefined,
    lifetimeBudgetCents: budgets.lifetime > 0 ? budgets.lifetime : undefined,
    destinationType: destinationSource?.destination_type,
    optimizationGoal: destinationSource?.optimization_goal,
    startTime: scheduleSource?.start_time,
    endTime: scheduleSource?.end_time,
  };
}

export function rollupAdSetsByCampaign(rows: MetaAdSetInput[]): Map<string, AdSetRollup> {
  const grouped = new Map<string, MetaAdSetInput[]>();

  for (const row of rows) {
    if (!row.campaign_id) continue;
    const list = grouped.get(row.campaign_id) ?? [];
    list.push(row);
    grouped.set(row.campaign_id, list);
  }

  const byCampaign = new Map<string, AdSetRollup>();
  for (const [campaignId, adSets] of grouped) {
    const rollup = rollupAdSetsForCampaign(adSets);
    if (rollup) byCampaign.set(campaignId, rollup);
  }

  return byCampaign;
}

export function resolveCampaignBudgetCents(input: {
  campaignDailyCents?: number;
  campaignLifetimeCents?: number;
  adSetRollup?: AdSetRollup;
}): { dailyBudgetCents?: number; lifetimeBudgetCents?: number } {
  const adSetDaily = input.adSetRollup?.dailyBudgetCents ?? 0;
  const adSetLifetime = input.adSetRollup?.lifetimeBudgetCents ?? 0;
  const campaignDaily = input.campaignDailyCents ?? 0;
  const campaignLifetime = input.campaignLifetimeCents ?? 0;

  return {
    dailyBudgetCents:
      adSetDaily > 0 ? adSetDaily : campaignDaily > 0 ? campaignDaily : undefined,
    lifetimeBudgetCents:
      adSetLifetime > 0 ? adSetLifetime : campaignLifetime > 0 ? campaignLifetime : undefined,
  };
}
