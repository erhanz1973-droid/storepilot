import type { AttributionChannelId } from "@/lib/attribution/models";

export type CustomerDataStatus = "verified" | "estimated" | "unavailable";

export type CustomerDataTier = "record_level" | "aggregated_only";

export type CustomerSegmentId =
  | "vip"
  | "returning"
  | "new"
  | "one_time"
  | "at_risk"
  | "inactive"
  | "high_spender";

export const CUSTOMER_SEGMENT_LABELS: Record<CustomerSegmentId, string> = {
  vip: "VIP Customers",
  returning: "Returning Customers",
  new: "New Customers",
  one_time: "One-Time Buyers",
  at_risk: "At-Risk Customers",
  inactive: "Inactive Customers",
  high_spender: "High Spenders",
};

export type CustomerStatus = "VIP" | "Growing" | "At Risk" | "Inactive" | "New" | "Healthy";

export type CustomerPurchase = {
  date: string;
  amount: number;
  itemCount: number;
  productTitles: string[];
};

export type CustomerFavoriteProduct = {
  productId: string;
  title: string;
  revenue: number;
  units: number;
};

export type CustomerRecord = {
  id: string;
  name: string;
  email: string;
  ordersCount: number;
  revenue30d: number;
  lifetimeRevenue: number;
  ltv: number | null;
  ltvStatus: CustomerDataStatus;
  aov: number;
  lastPurchaseAt: string;
  firstPurchaseAt: string;
  segment: CustomerSegmentId;
  status: CustomerStatus;
  acquisitionSource: AttributionChannelId | "unknown";
  acquisitionLabel: string;
  totalProfit: number | null;
  profitStatus: CustomerDataStatus;
  favoriteProducts: CustomerFavoriteProduct[];
  purchaseHistory: CustomerPurchase[];
  daysSinceLastPurchase: number;
  region?: string;
};

export type CustomerSnapshot = {
  dataTier: CustomerDataTier;
  storeAgeDays: number;
  orders30d?: number;
  totalCustomers: number;
  newCustomers30d: number;
  returningCustomers30d: number;
  repeatPurchaseRatePct: number;
  aov: number;
  aovStatus: CustomerDataStatus;
  /** True when counts/AOV/repeat rate were derived from synced order rows */
  aggregatedFromOrders?: boolean;
  customers: CustomerRecord[];
  /** Monthly cohort retention — month label → [30d, 60d, 90d] retention % */
  cohortRetention?: {
    month: string;
    cohortSize: number;
    retention30d: number;
    retention60d: number;
    retention90d: number;
  }[];
};

export type CustomerSegmentRow = {
  id: CustomerSegmentId;
  label: string;
  count: number;
  countStatus: CustomerDataStatus;
  revenueContribution: number | null;
  revenueStatus: CustomerDataStatus;
  revenueNotice?: string;
  shareOfRevenuePct: number | null;
};

export type CustomerAcquisitionRow = {
  channelId: string;
  label: string;
  customers: number;
  customersStatus: CustomerDataStatus;
  customersDisplay: string;
  revenue: number;
  revenueStatus: CustomerDataStatus;
  avgLtv: number | null;
  ltvStatus: CustomerDataStatus;
  sharePct: number;
};

export type CustomerOpportunity = {
  id: string;
  title: string;
  description: string;
  estimatedImpact: number;
  impactLabel: string;
  confidencePct: number;
};

export type CustomerAiInsight = {
  id: string;
  text: string;
  tone: "positive" | "neutral" | "warning";
};

export type CustomerLtvSummary = {
  status: CustomerDataStatus;
  average: number | null;
  median: number | null;
  highest: number | null;
  distribution: { label: string; count: number }[];
  unavailableReason?: string;
  requirements?: {
    shopifyCustomerSync: boolean;
    minHistoryDays: boolean;
    repeatPurchase: boolean;
    currentHistoryDays: number;
    requiredHistoryDays: number;
  };
};

export type CustomerHealthFactor = {
  id: string;
  label: string;
  score: number;
  maxScore: number;
};

export type CustomerHealthBreakdown = {
  overall: number;
  status: CustomerDataStatus;
  factors: CustomerHealthFactor[];
  explanation: string;
};

export type CustomerCohortPreview = {
  status: "waiting" | "available";
  currentHistoryDays: number;
  requiredHistoryDays: number;
  message: string;
};

export type CustomerMetricMeta = {
  value: string;
  status: CustomerDataStatus;
  notice?: string;
  /** Overrides default badge label (e.g. Verified (Aggregated)) */
  badgeLabel?: string;
};

export type CustomersExecutiveSummary = {
  totalCustomers: CustomerMetricMeta;
  newCustomers: CustomerMetricMeta;
  returningCustomers: CustomerMetricMeta;
  repeatPurchaseRate: CustomerMetricMeta;
  averageOrderValue: CustomerMetricMeta;
  estimatedLtv: CustomerMetricMeta;
  customerHealthScore: CustomerMetricMeta;
};

export type CustomerRfmSegment = {
  id: string;
  label: string;
  count: number;
  description: string;
};

export type CustomerGeoRow = {
  region: string;
  customers: number;
  revenue: number;
  sharePct: number;
};

export type CustomerIntelligenceAnalytics = {
  dataTier: CustomerDataTier;
  purchaseFrequency: CustomerMetricMeta;
  newVsReturning: CustomerMetricMeta;
  returningShare: CustomerMetricMeta;
  churnRiskCount: CustomerMetricMeta;
  top10RevenueShare: CustomerMetricMeta;
  repeatBuyers: CustomerMetricMeta;
  vipCount: CustomerMetricMeta;
  highPotentialCount: CustomerMetricMeta;
  rfmSegments: CustomerRfmSegment[];
  geographicDistribution: CustomerGeoRow[];
  highestLtvCustomers: CustomerRecord[];
  repeatBuyerCustomers: CustomerRecord[];
  highPotentialCustomers: CustomerRecord[];
};

export type CustomersPageView = {
  dataTier: CustomerDataTier;
  executiveSummary: CustomersExecutiveSummary;
  healthBreakdown: CustomerHealthBreakdown;
  cohortPreview: CustomerCohortPreview;
  segments: CustomerSegmentRow[];
  topCustomers: CustomerRecord[];
  acquisition: CustomerAcquisitionRow[];
  aiInsights: CustomerAiInsight[];
  ltv: CustomerLtvSummary;
  cohortsAvailable: boolean;
  cohortUnavailableReason?: string;
  cohortRetention: CustomerSnapshot["cohortRetention"];
  opportunities: CustomerOpportunity[];
  growthCharts: Record<
    "last7d" | "last30d" | "last90d",
    import("@/lib/analytics/types").ChartDefinition
  >;
  analytics: CustomerIntelligenceAnalytics;
  allHealthy: boolean;
};
