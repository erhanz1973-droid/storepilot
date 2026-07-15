/**
 * Permanent golden dataset — CI locks expected outputs.
 * Do not change numbers without an intentional formula-version bump + review.
 *
 * Scenario: 17 campaigns, last-30d sales, known margins/costs,
 * Prospecting Broad pause → recoverable $6,168 / net $636 / ROAS 2.68
 */

import type { RawFacts, RawCampaignFact } from "../facts/types";
import type { Decision } from "../decisions/types";
import { FORMULA_ENGINE_VERSION } from "../version";

export const GOLDEN_CAMPAIGN_LABEL =
  "If accepted, estimated cost savings ~$6,168–$11,102/mo (~$636/mo profit preserved).";

/** Locked expectations — FAIL BUILD if engine drifts */
export const GOLDEN_EXPECTED = {
  formulaVersion: FORMULA_ENGINE_VERSION,
  businessRecovery: 6168,
  netProfitImpact: 636,
  /** Blended ROAS = Revenue ÷ Ad Spend = 26800 ÷ 10000 */
  blendedRoas: 2.68,
  campaignCount: 17,
  window: "last30d" as const,
} as const;

function buildCampaigns(count: number): RawCampaignFact[] {
  return Array.from({ length: count }, (_, i) => {
    const spend = 400 + (i % 5) * 80;
    const revenue = Math.round(spend * (1.8 + (i % 7) * 0.15));
    return {
      id: `camp-golden-${String(i + 1).padStart(2, "0")}`,
      name: i === 0 ? "Prospecting Broad" : `Campaign ${i + 1}`,
      platform: i % 3 === 0 ? "google" : "meta",
      spend,
      revenue,
      purchases: 4 + (i % 6),
      clicks: 80 + i * 12,
      impressions: 4000 + i * 500,
    };
  });
}

/** Layer 1 — immutable facts for the golden store */
export function goldenRawFacts(): RawFacts {
  return {
    currency: "USD",
    window: GOLDEN_EXPECTED.window,
    commerce: {
      revenue: 26_800,
      orders: 310,
      refunds: 420,
      discounts: 800,
      taxes: null,
      shippingCost: 980,
      shippingRevenue: 0,
      cogs: 11_256, // ~58% gross margin
      platformFees: 540,
      sessions: 14_200,
      customers: 280,
      inventoryUnits: 1200,
      inventoryValue: 18_000,
    },
    advertising: {
      adSpend: 10_000,
      impressions: 280_000,
      clicks: 9_400,
      purchases: 190,
      attributedRevenue: 22_100,
    },
    campaigns: buildCampaigns(GOLDEN_EXPECTED.campaignCount),
    products: [],
    historicalPredictionAccuracy: 0.88,
    dataQualityScore: 0.92,
  };
}

/** Layer 3 — decision with legacy label (still the path Approval/Executive use today) */
export function goldenDecision(): Decision {
  return {
    id: "DEC-GOLDEN-2026-000001",
    reason: "Prospecting Broad is burning spend below target ROAS with recoverable waste.",
    priority: "high",
    confidenceScore: 0.92,
    risk: "low",
    goal: "reduce_waste",
    affectedEntities: [
      { type: "campaign", id: "camp-golden-01", name: "Prospecting Broad" },
    ],
    expectedAction: "Pause Prospecting Broad and reallocate budget to proven audiences.",
    financialInputs: {
      category: "campaign_review",
      expectedImpactLabel: GOLDEN_CAMPAIGN_LABEL,
      confidenceScore: 0.92,
      campaignCount: 1,
      observationPeriodDays: 30,
    },
    recommendationId: "rec-golden-prospecting-broad",
  };
}
