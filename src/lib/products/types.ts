import type { ProductProfitStatus } from "@/lib/profit/types";
import type { Opportunity } from "@/lib/types";

export type ProductTrendWindow = "last7d" | "last30d" | "previous30d";

export type ProductTrendMetrics = {
  revenue: number;
  netProfit: number;
  marginPct: number;
  units: number;
  roas: number | null;
};

export type ProductLifecycleStage =
  | "Launching"
  | "Growing"
  | "Winning"
  | "Stable"
  | "Declining"
  | "Dead Inventory";

export type ProductHealthFactor = {
  id: string;
  label: string;
  score: number;
  maxScore: number;
  explanation: string;
};

export type ProductMerchandisingInsight = {
  id: string;
  severity: "info" | "warning" | "opportunity";
  text: string;
};

export type ProductIntelligenceProfile = {
  productId: string;
  title: string;
  imageUrl: string | null;
  revenue: number;
  netSales: number;
  unitsSold: number;
  cogs: number;
  shippingCost: number;
  transactionFees: number;
  discounts: number;
  refunds: number;
  refundRatePct: number;
  refundCost: number;
  adCost: number;
  grossProfit: number;
  netProfit: number;
  marginPct: number;
  productRoas: number | null;
  inventory: number;
  daysUntilStockout: number | null;
  daysOutOfStock: number | null;
  dailyAdSpend: number;
  lastSaleDaysAgo: number | null;
  salesTrendLabel: string;
  lifecycleStage: ProductLifecycleStage;
  healthBreakdown: ProductHealthFactor[];
  inventoryRisk: "none" | "low_stock" | "overstock" | "dead";
  status: ProductProfitStatus;
  costSource: "shopify" | "manual" | "estimated";
  healthScore: number;
  healthLabel: "Excellent" | "Good" | "Fair" | "Poor";
  trends: {
    last7d: ProductTrendMetrics;
    last30d: ProductTrendMetrics;
    previous30d: ProductTrendMetrics;
    revenueGrowthPct: number | null;
    profitGrowthPct: number | null;
    marginTrendPct: number | null;
    refundTrendPct: number | null;
  };
  isHero: boolean;
  heroReason?: string;
  isHiddenWinner: boolean;
  hiddenWinnerReason?: string;
  isLosingMoney: boolean;
  catalogOnly: boolean;
};

export type ProductWidgetRow = {
  productId: string;
  title: string;
  imageUrl: string | null;
  value: number;
  valueLabel: string;
  sublabel?: string;
};

export type ProductIntelligenceDashboard = {
  syncedAt: string;
  products: ProductIntelligenceProfile[];
  heroes: ProductIntelligenceProfile[];
  hiddenWinners: ProductIntelligenceProfile[];
  losingMoney: ProductIntelligenceProfile[];
  inventoryRisk: ProductIntelligenceProfile[];
  topProfitable: ProductWidgetRow[];
  bestMargin: ProductWidgetRow[];
  highestRoas: ProductWidgetRow[];
  fastestGrowing: ProductWidgetRow[];
  highestRefunds: ProductWidgetRow[];
  productOpportunities: Opportunity[];
};

export type ProductSortKey =
  | "revenue"
  | "netProfit"
  | "marginPct"
  | "productRoas"
  | "revenueGrowthPct"
  | "daysUntilStockout";
