import { META_GRAPH_VERSION } from "@/lib/meta/oauth";
import type { MetaAdSnapshot } from "@/lib/meta/sync";

export type MetaAccountInsights30d = {
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  cpm: number;
  purchases: number;
  purchaseValue: number;
  roas: number;
};

type InsightActions = { action_type: string; value: string }[];

function parseActions(actions?: InsightActions, matcher: (t: string) => boolean = () => false): number {
  if (!actions) return 0;
  let total = 0;
  for (const action of actions) {
    if (matcher(action.action_type)) total += parseFloat(action.value) || 0;
  }
  return total;
}

function parsePurchaseCount(actions?: InsightActions): number {
  return parseActions(actions, (t) => t === "purchase" || t === "omni_purchase" || t.includes("purchase"));
}

function parsePurchaseValue(actionValues?: InsightActions): number {
  return parseActions(actionValues, (t) => t === "purchase" || t === "omni_purchase" || t.includes("purchase"));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export async function fetchMetaCampaignCount(
  accessToken: string,
  accountId: string,
): Promise<number> {
  const actId = accountId.startsWith("act_") ? accountId : `act_${accountId}`;
  const url = new URL(`https://graph.facebook.com/${META_GRAPH_VERSION}/${actId}/campaigns`);
  url.searchParams.set("fields", "id");
  url.searchParams.set("limit", "1");
  url.searchParams.set("summary", "total_count");
  url.searchParams.set("access_token", accessToken);

  const { logMetaApiRequest } = await import("@/lib/validation/meta/api-log");
  logMetaApiRequest(url.toString());

  const response = await fetch(url.toString(), {
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) return 0;

  const json = (await response.json()) as { summary?: { total_count?: number }; data?: unknown[] };
  if (json.summary?.total_count != null) return json.summary.total_count;
  return json.data?.length ?? 0;
}

export async function fetchMetaAccountInsights30d(
  accessToken: string,
  accountId: string,
): Promise<MetaAccountInsights30d> {
  const actId = accountId.startsWith("act_") ? accountId : `act_${accountId}`;
  const url = new URL(`https://graph.facebook.com/${META_GRAPH_VERSION}/${actId}/insights`);
  url.searchParams.set(
    "fields",
    "spend,impressions,clicks,ctr,cpc,cpm,actions,action_values",
  );
  url.searchParams.set("date_preset", "last_30d");
  url.searchParams.set("access_token", accessToken);

  const { logMetaApiRequest } = await import("@/lib/validation/meta/api-log");
  logMetaApiRequest(url.toString());

  const response = await fetch(url.toString(), {
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Meta insights error: ${text}`);
  }

  const json = (await response.json()) as {
    data?: {
      spend?: string;
      impressions?: string;
      clicks?: string;
      ctr?: string;
      cpc?: string;
      cpm?: string;
      actions?: InsightActions;
      action_values?: InsightActions;
    }[];
  };

  const row = json.data?.[0];
  const spend = parseFloat(row?.spend ?? "0");
  const purchaseValue = parsePurchaseValue(row?.action_values);
  const purchases = parsePurchaseCount(row?.actions);

  return {
    spend: round2(spend),
    impressions: parseInt(row?.impressions ?? "0", 10) || 0,
    clicks: parseInt(row?.clicks ?? "0", 10) || 0,
    ctr: round2(parseFloat(row?.ctr ?? "0")),
    cpc: round2(parseFloat(row?.cpc ?? "0")),
    cpm: round2(parseFloat(row?.cpm ?? "0")),
    purchases: Math.round(purchases),
    purchaseValue: round2(purchaseValue),
    roas: spend > 0 ? round2(purchaseValue / spend) : 0,
  };
}

export type MetaAccountInfo = {
  name: string;
  currency: string;
  timezone: string;
  accountStatus: number;
  businessName?: string;
};

export async function fetchMetaAccountInfo(
  accessToken: string,
  accountId: string,
): Promise<MetaAccountInfo> {
  const actId = accountId.startsWith("act_") ? accountId : `act_${accountId}`;
  const url = new URL(`https://graph.facebook.com/${META_GRAPH_VERSION}/${actId}`);
  url.searchParams.set("fields", "name,currency,timezone_name,account_status,business{name}");
  url.searchParams.set("access_token", accessToken);

  const { logMetaApiRequest } = await import("@/lib/validation/meta/api-log");
  logMetaApiRequest(url.toString());

  const response = await fetch(url.toString(), {
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Meta account info error: ${text}`);
  }

  const json = (await response.json()) as {
    name?: string;
    currency?: string;
    timezone_name?: string;
    account_status?: number;
    business?: { name?: string };
  };

  return {
    name: json.name ?? actId,
    currency: json.currency ?? "USD",
    timezone: json.timezone_name ?? "UTC",
    accountStatus: json.account_status ?? 0,
    businessName: json.business?.name,
  };
}

export function deriveDashboardMetaMetrics30d(snapshot: MetaAdSnapshot): MetaAccountInsights30d {
  const bucket = snapshot.accountRollups.last30d;
  const spend = bucket.spend;
  const purchaseValue = bucket.attributedRevenue;
  return {
    spend,
    impressions: 0,
    clicks: 0,
    ctr: 0,
    cpc: 0,
    cpm: 0,
    purchases: bucket.orders,
    purchaseValue,
    roas: spend > 0 ? round2(purchaseValue / spend) : 0,
  };
}

export function compareMetaMetrics(
  dashboard: MetaAccountInsights30d,
  api: MetaAccountInsights30d,
): import("./types").MetaMetricComparison[] {
  const tolerance = 0.02;
  const rows: { metric: string; dashboard: number; api: number }[] = [
    { metric: "Spend", dashboard: dashboard.spend, api: api.spend },
    { metric: "Impressions", dashboard: dashboard.impressions, api: api.impressions },
    { metric: "Clicks", dashboard: dashboard.clicks, api: api.clicks },
    { metric: "CTR", dashboard: dashboard.ctr, api: api.ctr },
    { metric: "CPC", dashboard: dashboard.cpc, api: api.cpc },
    { metric: "CPM", dashboard: dashboard.cpm, api: api.cpm },
    { metric: "Purchases", dashboard: dashboard.purchases, api: api.purchases },
    { metric: "Purchase Conversion Value", dashboard: dashboard.purchaseValue, api: api.purchaseValue },
    { metric: "ROAS", dashboard: dashboard.roas, api: api.roas },
  ];

  return rows.map((row) => {
    const delta = Math.abs(row.dashboard - row.api);
    const deliveryOnly =
      row.metric === "Impressions" ||
      row.metric === "Clicks" ||
      row.metric === "CTR" ||
      row.metric === "CPC" ||
      row.metric === "CPM";
    const match = deliveryOnly
      ? row.dashboard > 0 && delta <= tolerance
      : delta <= tolerance;
    return {
      metric: row.metric,
      dashboard: row.dashboard,
      api: row.api,
      match,
      delta: round2(delta),
    };
  });
}
