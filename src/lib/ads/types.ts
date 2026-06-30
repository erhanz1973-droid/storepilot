import type { ProfitWindow } from "@/lib/profit/types";

/** Ad platforms with spend data — extend as connectors ship */
export type AdPlatformId = "meta_ads" | "google_ads" | "tiktok";

/** All channels shown in business breakdown (paid + organic) */
export type BusinessChannelId =
  | AdPlatformId
  | "email"
  | "organic"
  | "direct"
  | "referral"
  | "unknown";

export type AdSpendBucket = {
  spend: number;
  /** Platform-attributed purchase revenue */
  attributedRevenue: number;
  orders: number;
};

export type AdSpendRollups = Record<ProfitWindow, AdSpendBucket>;

export type AdPlatformSnapshot = {
  platform: AdPlatformId;
  label: string;
  connected: boolean;
  rollups: AdSpendRollups;
  /** True when window values are extrapolated from 7d campaign totals */
  spendScaled: boolean;
};

export type AdSpendSnapshot = {
  platforms: AdPlatformSnapshot[];
  totalRollups: AdSpendRollups;
  spendScaled: boolean;
};

export type DailyMetricPoint = {
  date: string;
  revenue: number;
  adSpend: number;
  orders: number;
};

export type RoasTrendRange = "today" | "last7d" | "last30d" | "last90d";
