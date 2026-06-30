import type { MetaCampaign } from "@/lib/connectors/types";
import type { AdSpendBucket, AdSpendRollups } from "@/lib/ads/types";
import { emptyAdSpendRollups } from "@/lib/ads/spend";
import {
  type AdSetRollup,
  type MetaAdSetInput,
  resolveCampaignBudgetCents,
  rollupAdSetsByCampaign,
} from "@/lib/meta/ad-set-rollup";
import { normalizeEffectiveStatus } from "@/lib/meta/campaign-stats";
import { classifyCampaignObjective } from "@/lib/meta/campaign-objectives";
import { META_GRAPH_VERSION } from "@/lib/meta/oauth";
import type { ProfitWindow } from "@/lib/profit/types";
import { logMetaApiRequest } from "@/lib/validation/meta/api-log";

type MetaCampaignRow = {
  id: string;
  name: string;
  effective_status?: string;
  objective?: string;
  daily_budget?: string;
  lifetime_budget?: string;
  start_time?: string;
  stop_time?: string;
};

type MetaInsightRow = {
  campaign_id?: string;
  campaign_name?: string;
  spend?: string;
  impressions?: string;
  reach?: string;
  clicks?: string;
  ctr?: string;
  frequency?: string;
  actions?: { action_type: string; value: string }[];
  date_start?: string;
  date_stop?: string;
};

type GraphList<T> = { data?: T[]; paging?: { next?: string } };

function parsePurchaseRevenue(actions?: MetaInsightRow["actions"]): number {
  if (!actions) return 0;
  let total = 0;
  for (const action of actions) {
    if (
      action.action_type === "purchase" ||
      action.action_type === "omni_purchase" ||
      action.action_type.includes("purchase")
    ) {
      total += parseFloat(action.value) || 0;
    }
  }
  return total;
}

function parseActionCount(
  actions: MetaInsightRow["actions"] | undefined,
  matchers: string[],
): number {
  if (!actions) return 0;
  let total = 0;
  for (const action of actions) {
    const type = action.action_type.toLowerCase();
    if (matchers.some((m) => type === m || type.includes(m))) {
      total += parseFloat(action.value) || 0;
    }
  }
  return Math.round(total);
}

async function fetchGraphPages<T>(initialUrl: string): Promise<T[]> {
  const rows: T[] = [];
  let nextUrl: string | null = initialUrl;
  const timeoutMs = 20_000;
  let pageCount = 0;
  const maxPages = 50;

  while (nextUrl && pageCount < maxPages) {
    pageCount += 1;
    logMetaApiRequest(nextUrl);
    const response = await fetch(nextUrl, {
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Meta Ads API error: ${text}`);
    }

    const json = (await response.json()) as GraphList<T>;
    rows.push(...(json.data ?? []));
    nextUrl = json.paging?.next ?? null;
  }

  return rows;
}

type MetaAdSetRow = MetaAdSetInput;

async function fetchAdSetsByCampaign(
  accessToken: string,
  actId: string,
): Promise<Map<string, AdSetRollup>> {
  const url = new URL(`https://graph.facebook.com/${META_GRAPH_VERSION}/${actId}/adsets`);
  url.searchParams.set(
    "fields",
    "campaign_id,effective_status,daily_budget,lifetime_budget,destination_type,optimization_goal,start_time,end_time",
  );
  url.searchParams.set("limit", "100");
  url.searchParams.set("access_token", accessToken);

  const rows = await fetchGraphPages<MetaAdSetRow>(url.toString());
  return rollupAdSetsByCampaign(rows);
}

async function fetchCampaignStatuses(
  accessToken: string,
  actId: string,
): Promise<MetaCampaignRow[]> {
  const url = new URL(`https://graph.facebook.com/${META_GRAPH_VERSION}/${actId}/campaigns`);
  url.searchParams.set(
    "fields",
    "id,name,effective_status,objective,daily_budget,lifetime_budget,start_time,stop_time",
  );
  url.searchParams.set("limit", "100");
  url.searchParams.set("access_token", accessToken);

  return fetchGraphPages<MetaCampaignRow>(url.toString());
}

async function fetchCampaignInsights(
  accessToken: string,
  actId: string,
): Promise<Map<string, MetaInsightRow>> {
  const fields = [
    "campaign_id",
    "campaign_name",
    "spend",
    "impressions",
    "reach",
    "clicks",
    "ctr",
    "frequency",
    "actions",
  ].join(",");

  const url = new URL(`https://graph.facebook.com/${META_GRAPH_VERSION}/${actId}/insights`);
  url.searchParams.set("level", "campaign");
  url.searchParams.set("date_preset", "last_7d");
  url.searchParams.set("fields", fields);
  url.searchParams.set("limit", "100");
  url.searchParams.set("access_token", accessToken);

  const rows = await fetchGraphPages<MetaInsightRow>(url.toString());
  const byCampaignId = new Map<string, MetaInsightRow>();

  for (const row of rows) {
    if (row.campaign_id) {
      byCampaignId.set(row.campaign_id, row);
    }
  }

  return byCampaignId;
}

function insightToBucket(row?: MetaInsightRow): AdSpendBucket {
  const spend = parseFloat(row?.spend ?? "0");
  const attributedRevenue = parsePurchaseRevenue(row?.actions);
  return {
    spend: Math.round(spend * 100) / 100,
    attributedRevenue: Math.round(attributedRevenue * 100) / 100,
    orders: 0,
  };
}

async function fetchAccountInsightsPreset(
  accessToken: string,
  actId: string,
  datePreset: string,
): Promise<AdSpendBucket> {
  const url = new URL(`https://graph.facebook.com/${META_GRAPH_VERSION}/${actId}/insights`);
  url.searchParams.set("fields", "spend,actions");
  url.searchParams.set("date_preset", datePreset);
  url.searchParams.set("access_token", accessToken);

  const rows = await fetchGraphPages<MetaInsightRow>(url.toString());
  return insightToBucket(rows[0]);
}

export async function fetchMetaAccountRollups(
  accessToken: string,
  accountId: string,
): Promise<AdSpendRollups> {
  const actId = accountId.startsWith("act_") ? accountId : `act_${accountId}`;

  const [today, yesterday, last7d, last30d] = await Promise.all([
    fetchAccountInsightsPreset(accessToken, actId, "today"),
    fetchAccountInsightsPreset(accessToken, actId, "yesterday"),
    fetchAccountInsightsPreset(accessToken, actId, "last_7d"),
    fetchAccountInsightsPreset(accessToken, actId, "last_30d"),
  ]);

  return { today, yesterday, last7d, last30d };
}

export type MetaDailySpendPoint = {
  date: string;
  spend: number;
  attributedRevenue: number;
};

export async function fetchMetaDailySpend(
  accessToken: string,
  accountId: string,
  days = 90,
): Promise<MetaDailySpendPoint[]> {
  const actId = accountId.startsWith("act_") ? accountId : `act_${accountId}`;
  const preset = days <= 30 ? "last_30d" : "last_90d";

  const url = new URL(`https://graph.facebook.com/${META_GRAPH_VERSION}/${actId}/insights`);
  url.searchParams.set("fields", "spend,actions,date_start");
  url.searchParams.set("date_preset", preset);
  url.searchParams.set("time_increment", "1");
  url.searchParams.set("access_token", accessToken);

  const rows = await fetchGraphPages<MetaInsightRow>(url.toString());

  return rows
    .filter((r) => r.date_start)
    .map((r) => ({
      date: r.date_start!,
      spend: Math.round(parseFloat(r.spend ?? "0") * 100) / 100,
      attributedRevenue: Math.round(parsePurchaseRevenue(r.actions) * 100) / 100,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export type MetaAdSnapshot = {
  campaigns: MetaCampaign[];
  accountRollups: AdSpendRollups;
  dailySpend: MetaDailySpendPoint[];
};

export async function fetchMetaAdSnapshot(
  accessToken: string,
  accountId: string,
  meta?: { adAccountName?: string },
): Promise<MetaAdSnapshot> {
  const [campaigns, accountRollups, dailySpend] = await Promise.all([
    fetchMetaCampaigns(accessToken, accountId, meta),
    fetchMetaAccountRollups(accessToken, accountId).catch(() => emptyAdSpendRollups()),
    fetchMetaDailySpend(accessToken, accountId).catch(() => []),
  ]);

  return { campaigns, accountRollups, dailySpend };
}

function mergeAdSpendRollups(a: AdSpendRollups, b: AdSpendRollups): AdSpendRollups {
  const windows: ProfitWindow[] = ["today", "yesterday", "last7d", "last30d"];
  const result = emptyAdSpendRollups();
  for (const w of windows) {
    result[w] = {
      spend: Math.round((a[w].spend + b[w].spend) * 100) / 100,
      attributedRevenue:
        Math.round((a[w].attributedRevenue + b[w].attributedRevenue) * 100) / 100,
      orders: a[w].orders + b[w].orders,
    };
  }
  return result;
}

export function mergeMetaDailySpend(
  series: MetaDailySpendPoint[][],
): MetaDailySpendPoint[] {
  const byDate = new Map<string, MetaDailySpendPoint>();
  for (const points of series) {
    for (const p of points) {
      const existing = byDate.get(p.date);
      if (existing) {
        existing.spend = Math.round((existing.spend + p.spend) * 100) / 100;
        existing.attributedRevenue =
          Math.round((existing.attributedRevenue + p.attributedRevenue) * 100) / 100;
      } else {
        byDate.set(p.date, { ...p });
      }
    }
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function mergeMetaAccountRollups(rollups: AdSpendRollups[]): AdSpendRollups {
  return rollups.reduce((acc, r) => mergeAdSpendRollups(acc, r), emptyAdSpendRollups());
}

export async function fetchMetaCampaigns(
  accessToken: string,
  accountId: string,
  meta?: { adAccountName?: string },
): Promise<MetaCampaign[]> {
  const actId = accountId.startsWith("act_") ? accountId : `act_${accountId}`;

  const [campaignRows, insightsById, adSetsByCampaign] = await Promise.all([
    fetchCampaignStatuses(accessToken, actId),
    fetchCampaignInsights(accessToken, actId),
    fetchAdSetsByCampaign(accessToken, actId).catch(() => new Map<string, AdSetRollup>()),
  ]);

  return campaignRows.map((row) => {
    const rawStatus = (row.effective_status ?? "PAUSED").toUpperCase();
    const effectiveStatus = normalizeEffectiveStatus(rawStatus);
    const insight = insightsById.get(row.id);
    const adSet = adSetsByCampaign.get(row.id);
    const spend = parseFloat(insight?.spend ?? "0");
    const revenue = parsePurchaseRevenue(insight?.actions);
    const roas = spend > 0 ? revenue / spend : 0;
    const actions = insight?.actions;
    const leads = parseActionCount(actions, ["lead", "leadgen", "onsite_conversion.lead"]);
    const qualifiedLeads = parseActionCount(actions, ["qualified_lead", "quality_lead"]);
    const videoViews = parseActionCount(actions, ["video_view"]);
    const thruPlay = parseActionCount(actions, ["thruplay", "video_thruplay"]);
    const appInstalls = parseActionCount(actions, ["app_install", "omni_app_install", "mobile_app_install"]);
    const linkClicks = parseActionCount(actions, ["link_click"]);
    const conversions = parseActionCount(actions, ["purchase", "omni_purchase", "offsite_conversion.fb_pixel_purchase"]);
    const clicksParsed = parseInt(insight?.clicks ?? "0", 10) || linkClicks;

    const campaignDaily = row.daily_budget ? parseInt(row.daily_budget, 10) : 0;
    const campaignLifetime = row.lifetime_budget ? parseInt(row.lifetime_budget, 10) : 0;
    const { dailyBudgetCents, lifetimeBudgetCents } = resolveCampaignBudgetCents({
      campaignDailyCents: campaignDaily,
      campaignLifetimeCents: campaignLifetime,
      adSetRollup: adSet,
    });

    const startTime = adSet?.startTime ?? row.start_time;
    const stopTime = adSet?.endTime ?? row.stop_time;

    return {
      id: `${actId}:${row.id}`,
      name: row.name ?? insight?.campaign_name ?? "Unnamed campaign",
      status: effectiveStatus,
      effectiveStatus,
      metaEffectiveStatus: rawStatus,
      objective: row.objective,
      campaignObjective: classifyCampaignObjective({
        id: row.id,
        name: row.name ?? "Unnamed",
        status: effectiveStatus,
        effectiveStatus,
        metaEffectiveStatus: rawStatus,
        objective: row.objective,
        destinationType: adSet?.destinationType,
        optimizationGoal: adSet?.optimizationGoal,
        spend7d: Math.round(spend * 100) / 100,
        revenue7d: Math.round(revenue * 100) / 100,
        roas7d: Math.round(roas * 100) / 100,
        ctr7d: parseFloat(insight?.ctr ?? "0"),
        frequency7d: parseFloat(insight?.frequency ?? "0"),
        impressions7d: parseInt(insight?.impressions ?? "0", 10),
      }),
      destinationType: adSet?.destinationType,
      optimizationGoal: adSet?.optimizationGoal,
      dailyBudgetCents,
      lifetimeBudgetCents,
      currency: "USD",
      startTime,
      stopTime,
      spend7d: Math.round(spend * 100) / 100,
      revenue7d: Math.round(revenue * 100) / 100,
      roas7d: Math.round(roas * 100) / 100,
      ctr7d: parseFloat(insight?.ctr ?? "0"),
      frequency7d: parseFloat(insight?.frequency ?? "0"),
      impressions7d: parseInt(insight?.impressions ?? "0", 10),
      reach7d: parseInt(insight?.reach ?? "0", 10) || undefined,
      clicks7d: clicksParsed || undefined,
      conversions7d: conversions || undefined,
      leads7d: leads || undefined,
      qualifiedLeads7d: qualifiedLeads || undefined,
      videoViews7d: videoViews || undefined,
      thruPlay7d: thruPlay || undefined,
      appInstalls7d: appInstalls || undefined,
      adAccountId: actId,
      adAccountName: meta?.adAccountName,
    };
  });
}
