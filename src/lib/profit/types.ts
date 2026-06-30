export type ProfitWindow = "today" | "yesterday" | "last7d" | "last30d";

/** Financial inputs tracked for profit confidence */
export type ProfitInputId =
  | "revenue"
  | "product_costs"
  | "advertising"
  | "shipping_costs"
  | "packaging_costs"
  | "payment_fees"
  | "refunds"
  | "taxes";

export type ProfitInputSource =
  | "shopify"
  | "meta"
  | "google"
  | "tiktok"
  | "manual"
  | "csv"
  | "carrier"
  | "accounting"
  | "estimated"
  | "missing";

export type ProfitInputAvailability = {
  id: ProfitInputId;
  label: string;
  available: boolean;
  source: ProfitInputSource;
  estimated: boolean;
};

export type ProfitStatus = "verified" | "estimated" | "unavailable";

/** Reusable metadata for profit values across dashboard, API, AI, and reports */
export type ProfitMetricMeta = {
  value: number | null;
  status: ProfitStatus;
  confidence: number;
  missingInputs: ProfitInputId[];
};

export type ProfitConfidenceLevel = "High" | "Medium" | "Low";

export type ProfitConfidence = {
  scorePct: number;
  level: ProfitConfidenceLevel;
  status: ProfitStatus;
  productsWithActualCost: number;
  productsWithEstimatedCost: number;
  catalogProductsWithSales: number;
  usesEstimatedCogs: boolean;
  missingInputs: ProfitInputId[];
  inputs: ProfitInputAvailability[];
  reason: string;
  notice: string | null;
  setupRequired: boolean;
};

export type ProfitPeriodMetrics = {
  window: ProfitWindow;
  label: string;
  revenue: number;
  grossProfit: number;
  netProfit: number | null;
  netProfitMeta: ProfitMetricMeta;
  profitMarginPct: number | null;
  cogs: number;
  adSpend: number;
  shippingCost: number;
  transactionFees: number;
  refunds: number;
  orders: number;
  usesEstimatedCogs: boolean;
};

export type ProductProfitStatus =
  | "Healthy"
  | "Low Margin"
  | "Losing Money"
  | "Out of Stock"
  | "Low Stock";

export type ProductProfitRow = {
  productId: string;
  title: string;
  revenue: number;
  cogs: number;
  grossProfit: number;
  netProfit: number;
  marginPct: number;
  unitsSold: number;
  inventory: number;
  daysOfCover: number | null;
  status: ProductProfitStatus;
  unitCost: number | null;
  costSource: "shopify" | "manual" | "estimated";
  losingMoney: boolean;
};

export type CollectionProfitRow = {
  collectionId: string;
  title: string;
  revenue: number;
  cogs: number;
  grossProfit: number;
  netProfit: number;
  marginPct: number;
};

export type ChannelProfitRow = {
  channel: string;
  revenue: number;
  adSpend: number;
  grossProfit: number;
  roas: number | null;
};

export type ProfitAssumptions = {
  transactionFeeRate: number;
  transactionFeeFixed: number;
  adSpendScaled: boolean;
  productsMissingCost: number;
  productsWithEstimatedCost: number;
};

export type ProfitKpiTrend = {
  id: string;
  label: string;
  value: number | null;
  format: "currency" | "percent" | "roas";
  changePct: number | null;
  direction: "up" | "down" | "flat";
  periodLabel: string;
  isEstimated?: boolean;
  unavailable?: boolean;
  placeholder?: boolean;
  meta?: ProfitMetricMeta;
};

import type { BlendedRoasDashboard } from "@/lib/profit/roas";

export type ProfitDashboard = {
  syncedAt: string;
  currency: string;
  confidence: ProfitConfidence;
  /** Primary net profit with full confidence metadata */
  primaryProfit: ProfitMetricMeta;
  periods: ProfitPeriodMetrics[];
  primary: ProfitPeriodMetrics;
  kpis: ProfitKpiTrend[];
  blendedRoas: BlendedRoasDashboard | null;
  byProduct: ProductProfitRow[];
  byCollection: CollectionProfitRow[];
  byChannel: ChannelProfitRow[];
  assumptions: ProfitAssumptions;
  topProfitableProducts: ProductProfitRow[];
  losingProducts: ProductProfitRow[];
};

export const PROFIT_INPUT_LABELS: Record<ProfitInputId, string> = {
  revenue: "Revenue",
  product_costs: "Product Costs",
  advertising: "Advertising Costs",
  shipping_costs: "Shipping Costs",
  packaging_costs: "Packaging Costs",
  payment_fees: "Payment Fees",
  refunds: "Refunds",
  taxes: "Taxes",
};
