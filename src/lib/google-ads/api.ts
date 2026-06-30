import type { AdSpendRollups } from "@/lib/ads/types";
import { emptyAdSpendRollups } from "@/lib/ads/spend";
import type {
  GoogleAdsAdGroup,
  GoogleAdsCampaign,
  GoogleAdsCampaignType,
  GoogleAdsKeyword,
  GoogleAdsSnapshot,
} from "@/lib/integrations/types";
import { getGoogleAdsConfig, GOOGLE_ADS_API_VERSION, normalizeGoogleCustomerId } from "./oauth";
import { formatGoogleAdsApiError } from "./errors";

type GoogleSearchRow = Record<string, unknown>;

function microsToCurrency(micros: unknown): number {
  const n = Number(micros ?? 0);
  return Math.round((n / 1_000_000) * 100) / 100;
}

function mapChannelType(raw: unknown): GoogleAdsCampaignType {
  const value = String(raw ?? "UNSPECIFIED").toLowerCase();
  if (value.includes("performance_max")) return "performance_max";
  if (value.includes("shopping")) return "shopping";
  if (value.includes("search")) return "search";
  if (value.includes("display")) return "display";
  if (value.includes("video")) return "video";
  return "search";
}

async function googleAdsSearch(
  accessToken: string,
  customerId: string,
  query: string,
  loginCustomerId?: string,
): Promise<GoogleSearchRow[]> {
  const config = getGoogleAdsConfig();
  if (!config) throw new Error("Google Ads is not configured");

  const normalizedId = normalizeGoogleCustomerId(customerId);
  const url = `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers/${normalizedId}/googleAds:search`;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "developer-token": config.developerToken,
    "Content-Type": "application/json",
  };
  if (loginCustomerId) {
    headers["login-customer-id"] = normalizeGoogleCustomerId(loginCustomerId);
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ query }),
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(formatGoogleAdsApiError(text, response.status));
  }

  const json = (await response.json()) as { results?: GoogleSearchRow[] };
  return json.results ?? [];
}

export async function listAccessibleGoogleCustomers(
  accessToken: string,
): Promise<{ resourceNames: string[] }> {
  const config = getGoogleAdsConfig();
  if (!config) throw new Error("Google Ads is not configured");

  const response = await fetch(
    `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers:listAccessibleCustomers`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "developer-token": config.developerToken,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const text = await response.text();
    if (response.status === 404 && text.includes("<!DOCTYPE html>")) {
      throw new Error(
        `Google listAccessibleCustomers failed: API version ${GOOGLE_ADS_API_VERSION} not found (404). ` +
          `Set GOOGLE_ADS_API_VERSION to a supported version (e.g. v24).`,
      );
    }
    throw new Error(`Google listAccessibleCustomers failed: ${formatGoogleAdsApiError(text, response.status)}`);
  }

  return response.json() as Promise<{ resourceNames: string[] }>;
}

export async function fetchGoogleCustomerName(
  accessToken: string,
  customerId: string,
): Promise<string | null> {
  try {
    const rows = await googleAdsSearch(
      accessToken,
      customerId,
      "SELECT customer.descriptive_name FROM customer LIMIT 1",
    );
    const customer = rows[0]?.customer as { descriptiveName?: string } | undefined;
    return customer?.descriptiveName ?? null;
  } catch {
    return null;
  }
}

export async function listGoogleCustomersWithNames(
  accessToken: string,
): Promise<{ id: string; name: string }[]> {
  const { resourceNames } = await listAccessibleGoogleCustomers(accessToken);
  const customers = await Promise.all(
    resourceNames.map(async (resourceName) => {
      const id = normalizeGoogleCustomerId(resourceName);
      const name = (await fetchGoogleCustomerName(accessToken, id)) ?? `Account ${id}`;
      return { id, name };
    }),
  );
  return customers;
}

function buildRollupsFromDaily(
  daily: { date: string; spend: number; revenue: number }[],
): AdSpendRollups {
  const rollups = emptyAdSpendRollups();
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);

  let spend7d = 0;
  let rev7d = 0;
  let spend30d = 0;
  let rev30d = 0;
  let spendToday = 0;
  let revToday = 0;
  let spendYesterday = 0;
  let revYesterday = 0;

  for (const d of daily) {
    spend30d += d.spend;
    rev30d += d.revenue;
    if (d.date >= sevenDaysAgo) {
      spend7d += d.spend;
      rev7d += d.revenue;
    }
    if (d.date === today) {
      spendToday += d.spend;
      revToday += d.revenue;
    }
    if (d.date === yesterday) {
      spendYesterday += d.spend;
      revYesterday += d.revenue;
    }
  }

  rollups.today = { spend: spendToday, attributedRevenue: revToday, orders: 0 };
  rollups.yesterday = { spend: spendYesterday, attributedRevenue: revYesterday, orders: 0 };
  rollups.last7d = {
    spend: Math.round(spend7d * 100) / 100,
    attributedRevenue: Math.round(rev7d * 100) / 100,
    orders: 0,
  };
  rollups.last30d = {
    spend: Math.round(spend30d * 100) / 100,
    attributedRevenue: Math.round(rev30d * 100) / 100,
    orders: 0,
  };

  return rollups;
}

export async function fetchGoogleAdSnapshot(
  accessToken: string,
  customerId: string,
  options?: { customerName?: string },
): Promise<GoogleAdsSnapshot> {
  const campaignRows = await googleAdsSearch(
    accessToken,
    customerId,
    `SELECT
      campaign.id,
      campaign.name,
      campaign.status,
      campaign.advertising_channel_type,
      metrics.cost_micros,
      metrics.conversions_value,
      metrics.impressions,
      metrics.clicks,
      metrics.conversions
    FROM campaign
    WHERE segments.date DURING LAST_7_DAYS
      AND campaign.status != 'REMOVED'`,
  );

  const campaigns: GoogleAdsCampaign[] = campaignRows.map((row) => {
    const campaign = row.campaign as {
      id?: string;
      name?: string;
      status?: string;
      advertisingChannelType?: string;
    };
    const metrics = row.metrics as {
      costMicros?: string;
      conversionsValue?: number;
      impressions?: string;
      clicks?: string;
      conversions?: number;
    };
    const spend7d = microsToCurrency(metrics.costMicros);
    const revenue7d = Math.round(Number(metrics.conversionsValue ?? 0) * 100) / 100;
    const roas7d = spend7d > 0 ? Math.round((revenue7d / spend7d) * 100) / 100 : 0;

    return {
      id: String(campaign.id ?? ""),
      name: campaign.name ?? "Campaign",
      type: mapChannelType(campaign.advertisingChannelType),
      status: campaign.status ?? "UNKNOWN",
      spend7d,
      revenue7d,
      roas7d,
      impressions7d: Number(metrics.impressions ?? 0),
      clicks7d: Number(metrics.clicks ?? 0),
      conversions7d: Number(metrics.conversions ?? 0),
    };
  });

  const dailyRows = await googleAdsSearch(
    accessToken,
    customerId,
    `SELECT segments.date, metrics.cost_micros, metrics.conversions_value
     FROM campaign
     WHERE segments.date DURING LAST_30_DAYS
       AND campaign.status != 'REMOVED'`,
  );

  const dailyMap = new Map<string, { spend: number; revenue: number }>();
  for (const row of dailyRows) {
    const segments = row.segments as { date?: string };
    const metrics = row.metrics as { costMicros?: string; conversionsValue?: number };
    const date = segments.date ?? "";
    if (!date) continue;
    const existing = dailyMap.get(date) ?? { spend: 0, revenue: 0 };
    existing.spend += microsToCurrency(metrics.costMicros);
    existing.revenue += Number(metrics.conversionsValue ?? 0);
    dailyMap.set(date, existing);
  }

  const dailySpend = [...dailyMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({
      date,
      spend: Math.round(v.spend * 100) / 100,
    }));

  const dailyForRollups = [...dailyMap.entries()].map(([date, v]) => ({
    date,
    spend: v.spend,
    revenue: v.revenue,
  }));

  const rollups = buildRollupsFromDaily(dailyForRollups);

  const spend7dTotal = campaigns.reduce((s, c) => s + c.spend7d, 0);
  const rev7dTotal = campaigns.reduce((s, c) => s + c.revenue7d, 0);
  if (rollups.last7d.spend === 0 && spend7dTotal > 0) {
    rollups.last7d.spend = Math.round(spend7dTotal * 100) / 100;
    rollups.last7d.attributedRevenue = Math.round(rev7dTotal * 100) / 100;
    rollups.last30d.spend = Math.round(spend7dTotal * (30 / 7) * 100) / 100;
    rollups.last30d.attributedRevenue = Math.round(rev7dTotal * (30 / 7) * 100) / 100;
  }

  return {
    campaigns,
    adGroups: [] as GoogleAdsAdGroup[],
    keywords: [] as GoogleAdsKeyword[],
    searchTerms: [],
    rollups,
    dailySpend,
  };
}

export function mergeGoogleAccountRollups(rollupsList: AdSpendRollups[]): AdSpendRollups {
  const merged = emptyAdSpendRollups();
  for (const r of rollupsList) {
    for (const window of ["today", "yesterday", "last7d", "last30d"] as const) {
      merged[window].spend = Math.round((merged[window].spend + r[window].spend) * 100) / 100;
      merged[window].attributedRevenue =
        Math.round((merged[window].attributedRevenue + r[window].attributedRevenue) * 100) / 100;
    }
  }
  return merged;
}

export function mergeGoogleDailySpend(
  series: { date: string; spend: number }[][],
): { date: string; spend: number }[] {
  const byDate = new Map<string, number>();
  for (const list of series) {
    for (const d of list) {
      byDate.set(d.date, (byDate.get(d.date) ?? 0) + d.spend);
    }
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, spend]) => ({ date, spend: Math.round(spend * 100) / 100 }));
}
