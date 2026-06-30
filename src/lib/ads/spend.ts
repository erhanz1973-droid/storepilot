import type { MetaCampaign } from "@/lib/connectors/types";
import type {
  AdPlatformId,
  AdPlatformSnapshot,
  AdSpendBucket,
  AdSpendRollups,
  AdSpendSnapshot,
} from "./types";
import type { ProfitWindow } from "@/lib/profit/types";

const EMPTY_BUCKET: AdSpendBucket = { spend: 0, attributedRevenue: 0, orders: 0 };

export function emptyAdSpendRollups(): AdSpendRollups {
  return {
    today: { ...EMPTY_BUCKET },
    yesterday: { ...EMPTY_BUCKET },
    last7d: { ...EMPTY_BUCKET },
    last30d: { ...EMPTY_BUCKET },
  };
}

function addBuckets(a: AdSpendBucket, b: AdSpendBucket): AdSpendBucket {
  return {
    spend: Math.round((a.spend + b.spend) * 100) / 100,
    attributedRevenue: Math.round((a.attributedRevenue + b.attributedRevenue) * 100) / 100,
    orders: a.orders + b.orders,
  };
}

function sumRollups(rollups: AdSpendRollups[]): AdSpendRollups {
  const windows: ProfitWindow[] = ["today", "yesterday", "last7d", "last30d"];
  const result = emptyAdSpendRollups();
  for (const window of windows) {
    for (const r of rollups) {
      result[window] = addBuckets(result[window], r[window]);
    }
  }
  return result;
}

/** Extrapolate Meta 7d campaign totals into period windows (fallback) */
export function scaleCampaignSpendToRollups(campaigns: MetaCampaign[]): AdSpendRollups {
  const spend7d = campaigns.reduce((s, c) => s + c.spend7d, 0);
  const rev7d = campaigns.reduce((s, c) => s + c.revenue7d, 0);
  const dailySpend = spend7d / 7;
  const dailyRev = rev7d / 7;

  const bucket = (days: number): AdSpendBucket => ({
    spend: Math.round(dailySpend * days * 100) / 100,
    attributedRevenue: Math.round(dailyRev * days * 100) / 100,
    orders: 0,
  });

  return {
    today: bucket(1),
    yesterday: bucket(1),
    last7d: bucket(7),
    last30d: bucket(30),
  };
}

export function buildMetaPlatformSnapshot(
  campaigns: MetaCampaign[],
  accountRollups?: AdSpendRollups,
): AdPlatformSnapshot {
  const connected = campaigns.length > 0 || accountRollups != null;
  const spendScaled = !accountRollups;
  const rollups = accountRollups ?? scaleCampaignSpendToRollups(campaigns);

  return {
    platform: "meta_ads",
    label: "Meta",
    connected,
    rollups,
    spendScaled,
  };
}

export function buildGooglePlatformSnapshot(
  rollups: AdSpendRollups,
): AdPlatformSnapshot {
  return {
    platform: "google_ads",
    label: "Google",
    connected: true,
    rollups,
    spendScaled: false,
  };
}

export function buildTikTokPlatformSnapshot(
  rollups: AdSpendRollups,
): AdPlatformSnapshot {
  return {
    platform: "tiktok",
    label: "TikTok",
    connected: true,
    rollups,
    spendScaled: false,
  };
}

export function buildAdSpendSnapshot(options: {
  metaCampaigns?: MetaCampaign[];
  metaAccountRollups?: AdSpendRollups;
  googleRollups?: AdSpendRollups;
  tiktokRollups?: AdSpendRollups;
  klaviyoRollups?: AdSpendRollups;
}): AdSpendSnapshot {
  const platforms: AdPlatformSnapshot[] = [];

  const meta = buildMetaPlatformSnapshot(
    options.metaCampaigns ?? [],
    options.metaAccountRollups,
  );
  if (meta.connected) platforms.push(meta);

  if (options.googleRollups && options.googleRollups.last30d.spend > 0) {
    platforms.push(buildGooglePlatformSnapshot(options.googleRollups));
  }

  if (options.tiktokRollups && options.tiktokRollups.last30d.spend > 0) {
    platforms.push(buildTikTokPlatformSnapshot(options.tiktokRollups));
  }

  const totalRollups =
    platforms.length > 0
      ? sumRollups(platforms.map((p) => p.rollups))
      : emptyAdSpendRollups();

  return {
    platforms,
    totalRollups,
    spendScaled: platforms.some((p) => p.spendScaled),
  };
}

export function totalSpendForWindow(snapshot: AdSpendSnapshot, window: ProfitWindow): number {
  return snapshot.totalRollups[window].spend;
}

export function platformLabel(id: AdPlatformId): string {
  switch (id) {
    case "meta_ads":
      return "Meta";
    case "google_ads":
      return "Google";
    case "tiktok":
      return "TikTok";
  }
}
