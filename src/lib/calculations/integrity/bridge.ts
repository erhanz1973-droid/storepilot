/**
 * Bridge integrity fixtures → Layer 1 RawFacts for StorePilot engine tests.
 */

import type { RawFacts } from "../facts/types";
import {
  INTEGRITY_LOCKED,
  META_ADS_30D,
  SHOPIFY_ORDERS_30D,
} from "./fixtures";
import { sumMetaAds, sumShopifyOrders } from "./independent";
import type { Decision } from "../decisions/types";

export function integrityRawFacts(): RawFacts {
  const commerce = sumShopifyOrders(SHOPIFY_ORDERS_30D);
  const ads = sumMetaAds(META_ADS_30D);

  return {
    currency: INTEGRITY_LOCKED.currency,
    window: "last30d",
    commerce: {
      revenue: commerce.revenue,
      orders: commerce.orders,
      refunds: commerce.refunds,
      discounts: 0,
      taxes: null,
      shippingCost: commerce.shippingCost,
      shippingRevenue: 0,
      cogs: commerce.cogs,
      platformFees: commerce.platformFees,
      sessions: INTEGRITY_LOCKED.sessions,
      customers: INTEGRITY_LOCKED.customers,
      inventoryUnits: null,
      inventoryValue: null,
    },
    advertising: {
      adSpend: ads.adSpend,
      impressions: ads.impressions,
      clicks: ads.clicks,
      purchases: ads.purchases,
      attributedRevenue: ads.attributedRevenue,
    },
    campaigns: META_ADS_30D.map((c) => ({
      id: c.campaign_id,
      name: c.campaign_name,
      platform: "meta" as const,
      spend: c.spend,
      revenue: c.attributed_revenue,
      purchases: c.purchases,
      clicks: c.clicks,
      impressions: c.impressions,
    })),
    products: [],
    historicalPredictionAccuracy: 0.9,
    dataQualityScore: 0.95,
  };
}

export function integrityDecision(): Decision {
  return {
    id: "DEC-INTEGRITY-2026-000001",
    reason: "Prospecting Broad is below efficiency target with recoverable waste.",
    priority: "high",
    confidenceScore: 0.92,
    risk: "low",
    goal: "reduce_waste",
    affectedEntities: [
      { type: "campaign", id: "m01", name: "Prospecting Broad" },
    ],
    expectedAction: "Pause or reduce Prospecting Broad.",
    financialInputs: {
      category: "campaign_review",
      expectedImpactLabel: INTEGRITY_LOCKED.campaignLabel,
      confidenceScore: 0.92,
      campaignCount: 1,
      observationPeriodDays: 30,
    },
    recommendationId: "rec-integrity-prospecting",
  };
}
