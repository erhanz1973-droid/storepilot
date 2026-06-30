import { parseRevenueImpact } from "@/lib/approvals/presenter";
import { revenueToNetProfitImpact } from "@/lib/opportunities/profit-impact";
import { campaignHasDeliveryData } from "@/lib/ai/sales-trends";
import { hasActiveAdsConnector } from "@/lib/connectors/active";
import { getActiveCampaigns } from "@/lib/meta/campaign-stats";
import type { StoreSnapshot } from "@/lib/connectors/types";
import type {
  ImplementationEffort,
  Opportunity,
  OpportunityCategory,
  SupportingMetric,
} from "@/lib/types";

const CATEGORY_LABELS: Record<OpportunityCategory, string> = {
  inventory: "Inventory profit opportunity",
  pricing: "Pricing profit opportunity",
  bundle: "Bundle profit opportunity",
  merchandising: "Merchandising profit opportunity",
  marketing: "Marketing profit opportunity",
  advertising_efficiency: "Advertising efficiency",
  product_growth: "Product growth",
  marketing_attribution: "Marketing attribution",
  customer_retention: "Retention profit opportunity",
};

export { CATEGORY_LABELS };

function opp(
  partial: Omit<Opportunity, "estimatedMonthlyNetProfitImpact"> & {
    estimatedMonthlyRevenueImpact: number;
  },
  netMarginPct?: number,
): Opportunity | null {
  if (partial.estimatedMonthlyRevenueImpact <= 0) return null;
  const estimatedMonthlyNetProfitImpact = revenueToNetProfitImpact(
    partial.estimatedMonthlyRevenueImpact,
    partial.category,
    netMarginPct,
  );
  if (estimatedMonthlyNetProfitImpact <= 0) return null;
  return { ...partial, estimatedMonthlyNetProfitImpact };
}

function weeklyToMonthly(weekly: number): number {
  return Math.round(weekly * 4.33);
}

function evaluateInventoryOpportunities(
  snapshot: StoreSnapshot,
  netMarginPct?: number,
): Opportunity[] {
  const results: Opportunity[] = [];

  for (const product of snapshot.products) {
    const dailyVelocity = product.unitsSold30d / 30;
    const daysOfCover =
      dailyVelocity > 0 ? product.inventoryQuantity / dailyVelocity : 999;

    if (product.inventoryQuantity > 15 || dailyVelocity < 2) continue;

    const weeklyAtRisk = Math.round(dailyVelocity * product.price * 7);
    const monthlyImpact = weeklyToMonthly(weeklyAtRisk);

    const item = opp({
      id: `opp-inv-${product.id}`,
      category: "inventory",
      title: `Capture demand — restock ${product.title}`,
      description: `${product.title} sells ~${dailyVelocity.toFixed(1)} units/day with only ${product.inventoryQuantity} on hand (~${daysOfCover.toFixed(0)} days of cover). Restocking protects profit from stockouts on a high-velocity SKU.`,
      estimatedMonthlyRevenueImpact: monthlyImpact,
      confidenceScore: daysOfCover <= 5 ? 0.9 : 0.82,
      evidence: [
        { label: "Units on hand", value: String(product.inventoryQuantity) },
        { label: "30-day units sold", value: String(product.unitsSold30d) },
        { label: "Days of cover", value: daysOfCover.toFixed(1) },
        { label: "30-day revenue", value: `$${product.revenue30d.toLocaleString()}` },
      ],
      requiredActions: [
        "Place replenishment order before stockout window",
        "Confirm lead time with supplier",
        "Enable low-stock alerts for this SKU",
      ],
      implementationEffort: "Low",
      recommendationId: `inv-${product.id}`,
    }, netMarginPct);
    if (item) results.push(item);
  }

  return results;
}

function evaluatePricingOpportunities(
  snapshot: StoreSnapshot,
  netMarginPct?: number,
): Opportunity[] {
  const results: Opportunity[] = [];

  for (const product of snapshot.products) {
    if (product.unitsSold30d > 20 || product.price < 80) continue;

    const monthlyImpact = Math.round(product.revenue30d * 0.05);

    const item = opp({
      id: `opp-price-${product.id}`,
      category: "pricing",
      title: `Test price lift — ${product.title}`,
      description: `${product.title} moves ${product.unitsSold30d} units/month at $${product.price}. Low velocity at a premium price point suggests room to test a modest increase without heavy discounting.`,
      estimatedMonthlyRevenueImpact: monthlyImpact,
      confidenceScore: 0.64,
      evidence: [
        { label: "Current price", value: `$${product.price}` },
        { label: "30-day units sold", value: String(product.unitsSold30d) },
        { label: "30-day revenue", value: `$${product.revenue30d.toLocaleString()}` },
        { label: "Inventory on hand", value: String(product.inventoryQuantity) },
      ],
      requiredActions: [
        "Run a 5% price test on the SKU",
        "Monitor conversion and units sold for 14 days",
        "Roll back if sell-through drops more than 10%",
      ],
      implementationEffort: "Medium",
      recommendationId: `price-${product.id}`,
    }, netMarginPct);
    if (item) results.push(item);
  }

  return results;
}

function evaluateBundleOpportunities(
  snapshot: StoreSnapshot,
  netMarginPct?: number,
): Opportunity[] {
  const bundleCandidates = snapshot.products.filter((p) =>
    p.tags.includes("bundle-candidate"),
  );
  if (bundleCandidates.length < 2) return [];

  const combinedRevenue = bundleCandidates.reduce((s, p) => s + p.revenue30d, 0);
  const attachRate = 0.12;
  const aovLift = snapshot.storeMetrics.aov30d * 0.1;
  const monthlyImpact = Math.round(snapshot.storeMetrics.orders30d * attachRate * aovLift);

  const item = opp({
    id: "opp-bundle-daily-routine",
    category: "bundle",
    title: "Launch a routine bundle",
    description: `Customers often buy ${bundleCandidates.map((p) => p.title).join(" and ")} separately. A bundled offer can lift average order value without discounting hero SKUs.`,
    estimatedMonthlyRevenueImpact: monthlyImpact,
    confidenceScore: 0.72,
    evidence: [
      { label: "Bundle SKUs", value: String(bundleCandidates.length) },
      { label: "Combined 30-day revenue", value: `$${combinedRevenue.toLocaleString()}` },
      { label: "Store AOV", value: `$${snapshot.storeMetrics.aov30d.toFixed(2)}` },
      { label: "Orders (30d)", value: String(snapshot.storeMetrics.orders30d) },
    ],
    requiredActions: [
      "Create a bundle product in Shopify",
      "Price bundle at 8–12% below sum of components",
      "Merchandise on homepage and cart upsell",
    ],
    implementationEffort: "Medium",
    recommendationId: "bundle-daily-routine",
  }, netMarginPct);

  return item ? [item] : [];
}

function evaluateMerchandisingOpportunities(
  snapshot: StoreSnapshot,
  netMarginPct?: number,
): Opportunity[] {
  const topCollection = [...snapshot.collections].sort(
    (a, b) => b.revenue30d - a.revenue30d,
  )[0];
  const featured = snapshot.collections.find((c) => c.homepageFeatured);

  if (!topCollection || !featured || topCollection.id === featured.id) return [];

  const monthlyImpact = Math.round(topCollection.revenue30d * 0.14);

  const item = opp({
    id: `opp-merch-${topCollection.id}`,
    category: "merchandising",
    title: `Feature ${topCollection.title} on homepage`,
    description: `"${topCollection.title}" generated $${topCollection.revenue30d.toLocaleString()} in 30 days but is not homepage-featured. "${featured.title}" is featured with lower revenue.`,
    estimatedMonthlyRevenueImpact: monthlyImpact,
    confidenceScore: 0.8,
    evidence: [
      { label: "Top collection revenue", value: `$${topCollection.revenue30d.toLocaleString()}` },
      { label: "Featured collection revenue", value: `$${featured.revenue30d.toLocaleString()}` },
      { label: "Top collection products", value: String(topCollection.productCount) },
      { label: "Store conversion rate", value: `${snapshot.storeMetrics.conversionRate30d}%` },
    ],
    requiredActions: [
      "Swap homepage hero to top-performing collection",
      "Update collection imagery and copy",
      "Track homepage-to-collection CTR for 7 days",
    ],
    implementationEffort: "Low",
    recommendationId: `home-${topCollection.id}`,
  }, netMarginPct);

  return item ? [item] : [];
}

function evaluateAdvertisingEfficiencyOpportunities(
  snapshot: StoreSnapshot,
  netMarginPct?: number,
): Opportunity[] {
  if (!hasActiveAdsConnector(snapshot.connectorStates)) return [];

  const results: Opportunity[] = [];
  const activeCampaigns = getActiveCampaigns(snapshot.campaigns);

  for (const campaign of activeCampaigns) {
    if (!campaignHasDeliveryData(campaign)) continue;

    if (campaign.roas7d >= 2 && campaign.frequency7d < 3) {
      const incrementalWeeklySpend = Math.round(campaign.spend7d * 0.2);
      const monthlyImpact = weeklyToMonthly(
        Math.round(incrementalWeeklySpend * campaign.roas7d),
      );
      const expectedRoas = Math.round(campaign.roas7d * 100) / 100;

      const item = opp({
        id: `opp-ad-scale-${campaign.id}`,
        category: "advertising_efficiency",
        title: `Scale campaign — ${campaign.name}`,
        description: `${campaign.name} delivers ROAS ${expectedRoas.toFixed(2)} with healthy frequency (${campaign.frequency7d.toFixed(1)}). Increasing budget should improve net profit while maintaining efficiency.`,
        estimatedMonthlyRevenueImpact: monthlyImpact,
        expectedRoas,
        adEfficiencyAction: "scale_campaign",
        confidenceScore: 0.78,
        evidence: [
          { label: "Current ROAS (7d)", value: expectedRoas.toFixed(2), trend: "up" },
          { label: "Expected ROAS", value: expectedRoas.toFixed(2) },
          { label: "7-day spend", value: `$${campaign.spend7d.toLocaleString()}` },
          { label: "Est. net profit gain", value: `$${Math.round(monthlyImpact * 0.55).toLocaleString()}/mo` },
        ],
        requiredActions: [
          "Increase daily budget 15–20% on winning ad sets",
          "Duplicate top creative before scaling",
          "Monitor Blended ROAS for 5 days after change",
        ],
        implementationEffort: "Medium",
        recommendationId: `camp-${campaign.id}`,
      }, netMarginPct);
      if (item) results.push(item);
      continue;
    }

    if (campaign.roas7d < 1.2 || campaign.frequency7d > 4) {
      const weeklyRecovery = Math.round(campaign.spend7d * 0.28);
      const monthlyImpact = weeklyToMonthly(weeklyRecovery);
      const losing = campaign.roas7d < 1;
      const action: Opportunity["adEfficiencyAction"] = losing
        ? "pause_campaign"
        : "reduce_budget";

      const item = opp({
        id: `opp-ad-${action}-${campaign.id}`,
        category: "advertising_efficiency",
        title: losing
          ? `Pause campaign — ${campaign.name}`
          : `Reduce budget — ${campaign.name}`,
        description: losing
          ? `${campaign.name} spent $${campaign.spend7d} for $${campaign.revenue7d} return (ROAS ${campaign.roas7d.toFixed(2)}). Pausing recovers wasted spend and improves Blended ROAS.`
          : `${campaign.name} shows frequency ${campaign.frequency7d.toFixed(1)} with ROAS ${campaign.roas7d.toFixed(2)}. Reducing budget protects net profit.`,
        estimatedMonthlyRevenueImpact: monthlyImpact,
        expectedRoas: losing ? 0 : Math.round(campaign.roas7d * 100) / 100,
        adEfficiencyAction: action,
        confidenceScore: losing ? 0.86 : 0.74,
        evidence: [
          { label: "ROAS (7d)", value: campaign.roas7d.toFixed(2), trend: "down" },
          { label: "7-day spend", value: `$${campaign.spend7d.toLocaleString()}` },
          { label: "7-day revenue", value: `$${campaign.revenue7d.toLocaleString()}` },
          { label: "Frequency (7d)", value: campaign.frequency7d.toFixed(1) },
        ],
        requiredActions: losing
          ? ["Pause underperforming ad sets", "Reallocate budget to profitable campaigns"]
          : [
              "Reduce daily budget 20–30%",
              "Audit ad set targeting and exclusions",
              "Rotate or replace fatigued creative",
            ],
        implementationEffort: losing ? "Low" : "High",
        recommendationId: `camp-${campaign.id}`,
      }, netMarginPct);
      if (item) results.push(item);
    } else if (campaign.roas7d >= 1.2 && campaign.roas7d < 2) {
      const monthlyImpact = weeklyToMonthly(Math.round(campaign.spend7d * 0.12));
      const item = opp({
        id: `opp-ad-increase-${campaign.id}`,
        category: "advertising_efficiency",
        title: `Increase budget — ${campaign.name}`,
        description: `${campaign.name} is profitable at ROAS ${campaign.roas7d.toFixed(2)} but below scale threshold. A modest budget increase can lift revenue while monitoring Blended ROAS.`,
        estimatedMonthlyRevenueImpact: monthlyImpact,
        expectedRoas: Math.round(campaign.roas7d * 100) / 100,
        adEfficiencyAction: "increase_budget",
        confidenceScore: 0.68,
        evidence: [
          { label: "ROAS (7d)", value: campaign.roas7d.toFixed(2) },
          { label: "Expected ROAS", value: campaign.roas7d.toFixed(2) },
          { label: "7-day spend", value: `$${campaign.spend7d.toLocaleString()}` },
        ],
        requiredActions: [
          "Increase budget 10% and monitor for 7 days",
          "Hold if Blended ROAS drops below target",
        ],
        implementationEffort: "Low",
        recommendationId: `camp-${campaign.id}`,
      }, netMarginPct);
      if (item) results.push(item);
    }
  }

  return results;
}

function evaluateRetentionOpportunities(
  snapshot: StoreSnapshot,
  netMarginPct?: number,
): Opportunity[] {
  const results: Opportunity[] = [];

  const promoCandidate = snapshot.products.find(
    (p) => p.unitsSold30d >= 40 && p.inventoryQuantity >= 40 && !p.compareAtPrice,
  );
  if (promoCandidate) {
    const monthlyImpact = Math.round(promoCandidate.revenue30d * 0.22);

    const item = opp({
      id: `opp-retain-promo-${promoCandidate.id}`,
      category: "customer_retention",
      title: `Loyalty offer — ${promoCandidate.title}`,
      description: `${promoCandidate.title} has steady repeat demand (${promoCandidate.unitsSold30d} sold / 30d) and healthy stock. A limited offer for returning buyers can lift repeat purchase rate.`,
      estimatedMonthlyRevenueImpact: monthlyImpact,
      confidenceScore: 0.75,
      evidence: [
        { label: "30-day units sold", value: String(promoCandidate.unitsSold30d) },
        { label: "Inventory on hand", value: String(promoCandidate.inventoryQuantity) },
        { label: "Price", value: `$${promoCandidate.price}` },
        { label: "30-day revenue", value: `$${promoCandidate.revenue30d.toLocaleString()}` },
      ],
      requiredActions: [
        "Create a returning-customer segment in email/SMS",
        "Offer 10–15% for 14 days on this SKU",
        "Measure repeat purchase rate vs. control",
      ],
      implementationEffort: "Medium",
      recommendationId: `promo-${promoCandidate.id}`,
    }, netMarginPct);
    if (item) results.push(item);
  }

  const slowMover = snapshot.products.find(
    (p) => p.unitsSold30d <= 20 && p.inventoryQuantity >= 30,
  );
  if (slowMover) {
    const monthlyImpact = Math.round(slowMover.revenue30d * 0.35);

    const item = opp({
      id: `opp-retain-winback-${slowMover.id}`,
      category: "customer_retention",
      title: `Win-back campaign — ${slowMover.title}`,
      description: `Past buyers of ${slowMover.title} may respond to a targeted win-back. ${slowMover.inventoryQuantity} units on hand — converting lapsed buyers recovers margin without broad discounting.`,
      estimatedMonthlyRevenueImpact: monthlyImpact,
      confidenceScore: 0.68,
      evidence: [
        { label: "30-day units sold", value: String(slowMover.unitsSold30d) },
        { label: "Inventory on hand", value: String(slowMover.inventoryQuantity) },
        { label: "30-day revenue", value: `$${slowMover.revenue30d.toLocaleString()}` },
        {
          label: "Sell-through rate",
          value: `${((slowMover.unitsSold30d / Math.max(slowMover.inventoryQuantity, 1)) * 100).toFixed(0)}%`,
          trend: "down",
        },
      ],
      requiredActions: [
        "Build a win-back segment for past purchasers",
        "Send personalized offer with urgency (7-day window)",
        "Exclude recent full-price buyers from discount",
      ],
      implementationEffort: "Medium",
      recommendationId: `slow-${slowMover.id}`,
    }, netMarginPct);
    if (item) results.push(item);
  }

  const topProduct = [...snapshot.products].sort(
    (a, b) => b.revenue30d - a.revenue30d,
  )[0];
  if (topProduct && topProduct.unitsSold30d >= 80) {
    const monthlyImpact = Math.round(topProduct.revenue30d * 0.08);

    const item = opp({
      id: `opp-retain-vip-${topProduct.id}`,
      category: "customer_retention",
      title: `VIP segment — ${topProduct.title} buyers`,
      description: `Buyers of ${topProduct.title} (${topProduct.unitsSold30d} units / 30d) are your core segment. Early access or bundle perks can increase lifetime value.`,
      estimatedMonthlyRevenueImpact: monthlyImpact,
      confidenceScore: 0.7,
      evidence: [
        { label: "30-day units sold", value: String(topProduct.unitsSold30d) },
        { label: "30-day revenue", value: `$${topProduct.revenue30d.toLocaleString()}` },
        { label: "Store orders (30d)", value: String(snapshot.storeMetrics.orders30d) },
        { label: "Store AOV", value: `$${snapshot.storeMetrics.aov30d.toFixed(2)}` },
      ],
      requiredActions: [
        "Tag high-frequency buyers in Shopify/Klaviyo",
        "Offer early access to new launches",
        "Test post-purchase cross-sell flow",
      ],
      implementationEffort: "Low",
    }, netMarginPct);
    if (item) results.push(item);
  }

  return results;
}

export function sortOpportunities(opportunities: Opportunity[]): Opportunity[] {
  return [...opportunities].sort(
    (a, b) =>
      b.estimatedMonthlyNetProfitImpact - a.estimatedMonthlyNetProfitImpact ||
      (b.expectedRoas ?? 0) - (a.expectedRoas ?? 0) ||
      b.confidenceScore - a.confidenceScore,
  );
}

export function evaluateOpportunities(
  snapshot: StoreSnapshot,
  options?: { limit?: number; netMarginPct?: number; extra?: Opportunity[] },
): Opportunity[] {
  const netMarginPct = options?.netMarginPct;
  const all = [
    ...evaluateInventoryOpportunities(snapshot, netMarginPct),
    ...evaluatePricingOpportunities(snapshot, netMarginPct),
    ...evaluateBundleOpportunities(snapshot, netMarginPct),
    ...evaluateMerchandisingOpportunities(snapshot, netMarginPct),
    ...evaluateAdvertisingEfficiencyOpportunities(snapshot, netMarginPct),
    ...evaluateRetentionOpportunities(snapshot, netMarginPct),
    ...(options?.extra ?? []),
  ];

  const sorted = sortOpportunities(all);
  const limit = options?.limit ?? 8;
  return sorted.slice(0, limit);
}

export function formatMonthlyImpact(amount: number): string {
  return amount.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

export function formatNetProfitImpact(amount: number): string {
  return formatMonthlyImpact(amount);
}

/** Map a stored recommendation to monthly impact when linked to an opportunity */
export function monthlyImpactFromRecommendation(expectedImpact: string): number {
  return parseRevenueImpact(expectedImpact);
}
