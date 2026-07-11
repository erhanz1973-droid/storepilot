export type AnalyticsDateRange =
  | "today"
  | "yesterday"
  | "last7d"
  | "last30d"
  | "last90d"
  | "custom";

export const ANALYTICS_DATE_RANGE_LABELS: Record<AnalyticsDateRange, string> = {
  today: "Today",
  yesterday: "Yesterday",
  last7d: "Last 7 Days",
  last30d: "Last 30 Days",
  last90d: "Last 90 Days",
  custom: "Custom Range",
};

export type MetricCard = {
  id: string;
  label: string;
  value: string;
  changePct?: number | null;
  sublabel?: string;
  tone?: "default" | "positive" | "negative" | "warning";
  /** Hero KPI — larger visual treatment (profit) */
  emphasize?: boolean;
  profitConfidence?: {
    status: "verified" | "estimated" | "unavailable";
    scorePct: number;
    setupRequired?: boolean;
  };
};

export type ChartSeries = {
  id: string;
  label: string;
  color: string;
  points: { date: string; value: number }[];
};

export type ChartDefinition = {
  id: string;
  title: string;
  series: ChartSeries[];
  format?: "currency" | "number" | "percent" | "ratio";
};

export type TableColumn<T> = {
  id: string;
  header: string;
  accessor: (row: T) => string | number;
  sortable?: boolean;
  align?: "left" | "right" | "center";
  format?: "currency" | "number" | "percent" | "text" | "ratio";
};

export type MarketingChannel = "meta" | "google" | "tiktok" | "pinterest";

export type MarketingCampaignRow = {
  id: string;
  channel: MarketingChannel;
  campaign: string;
  status: string;
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  ctr: number;
  cpc: number;
  cpm: number;
  purchases: number;
  cpa: number;
  revenue: number;
  roas: number;
  profit: number;
  margin: number;
  /** True when profit is not available from source — display as — */
  profitEstimated?: boolean;
};

export type FunnelStep = {
  id: string;
  label: string;
  count: number;
  conversionPct: number;
  dropPct: number;
  lostUsers: number;
};

export type AnalyticsPageContext =
  | "executive"
  | "marketing"
  | "traffic"
  | "sales"
  | "products"
  | "customers"
  | "funnel"
  | "inventory"
  | "profit"
  | "attribution"
  | "advertising"
  | "insights"
  | "live";
