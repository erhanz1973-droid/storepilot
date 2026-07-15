/**
 * Layer 1 — Raw Facts
 *
 * Immutable inputs imported from external systems. No derived math.
 * Every KPI and DecisionImpact calculation starts here.
 */

export type RawWindow = "today" | "yesterday" | "last7d" | "last30d" | "monthly";

export type RawCommerceFacts = {
  revenue: number;
  orders: number;
  refunds: number;
  discounts: number;
  taxes: number | null;
  shippingCost: number;
  shippingRevenue: number;
  cogs: number;
  platformFees: number;
  sessions: number | null;
  customers: number | null;
  inventoryUnits: number | null;
  inventoryValue: number | null;
};

export type RawAdvertisingFacts = {
  adSpend: number;
  impressions: number;
  clicks: number;
  purchases: number;
  attributedRevenue: number;
};

export type RawCampaignFact = {
  id: string;
  name: string;
  platform: "meta" | "google" | "other";
  spend: number;
  revenue: number;
  purchases: number;
  clicks: number;
  impressions: number;
};

export type RawProductFact = {
  id: string;
  title: string;
  revenue: number;
  unitsSold: number;
  unitCost: number | null;
  inventoryQuantity: number;
  price: number;
};

export type RawFacts = {
  /** ISO currency code (display/assumption only until multi-currency math ships) */
  currency: string;
  window: RawWindow;
  commerce: RawCommerceFacts;
  advertising: RawAdvertisingFacts;
  campaigns: RawCampaignFact[];
  products: RawProductFact[];
  /** Optional historical accuracy 0–1 from measured outcomes */
  historicalPredictionAccuracy: number | null;
  /** Optional data freshness score 0–1 */
  dataQualityScore: number | null;
};

export function emptyCommerceFacts(): RawCommerceFacts {
  return {
    revenue: 0,
    orders: 0,
    refunds: 0,
    discounts: 0,
    taxes: null,
    shippingCost: 0,
    shippingRevenue: 0,
    cogs: 0,
    platformFees: 0,
    sessions: null,
    customers: null,
    inventoryUnits: null,
    inventoryValue: null,
  };
}

export function emptyAdvertisingFacts(): RawAdvertisingFacts {
  return {
    adSpend: 0,
    impressions: 0,
    clicks: 0,
    purchases: 0,
    attributedRevenue: 0,
  };
}

export function emptyRawFacts(partial?: Partial<RawFacts>): RawFacts {
  return {
    currency: "USD",
    window: "last30d",
    commerce: emptyCommerceFacts(),
    advertising: emptyAdvertisingFacts(),
    campaigns: [],
    products: [],
    historicalPredictionAccuracy: null,
    dataQualityScore: null,
    ...partial,
  };
}
