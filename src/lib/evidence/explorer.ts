import { explainRecommendation } from "@/lib/ai/explain";
import type { BusinessContext } from "@/lib/ai/types";
import { analyzeSalesTrends } from "@/lib/ai/sales-trends";
import { getCategoryLearningStats, getHistoricalAccuracyNote } from "@/lib/learning/outcomes";
import type { Opportunity, Recommendation, SupportingMetric } from "@/lib/types";
import type {
  DataFreshness,
  EvidenceSection,
  HistoricalComparison,
  RecommendationEvidence,
} from "./types";

function formatCurrency(n: number): string {
  return n.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function buildHistoricalComparisons(context: BusinessContext): HistoricalComparison[] {
  const analysis = analyzeSalesTrends(context.salesTrends);
  const comparisons: HistoricalComparison[] = [];

  if (analysis.weekOverWeek) {
    const w = analysis.weekOverWeek;
    comparisons.push({
      label: "Week over week revenue",
      current: formatCurrency(w.currentRevenue),
      previous: formatCurrency(w.previousRevenue),
      changePct: w.changePct,
      direction: w.direction,
    });
  }

  if (analysis.monthOverMonth) {
    const m = analysis.monthOverMonth;
    comparisons.push({
      label: "30-day vs prior 30-day revenue",
      current: formatCurrency(m.currentRevenue),
      previous: formatCurrency(m.previousRevenue),
      changePct: m.changePct,
      direction: m.direction,
    });
  }

  return comparisons;
}

function buildRevenueSection(context: BusinessContext): EvidenceSection {
  const metrics = [
    { label: "Store revenue (30d)", value: formatCurrency(context.storeMetrics.revenue30d) },
    { label: "Orders (30d)", value: String(context.storeMetrics.orders30d) },
    { label: "AOV (30d)", value: formatCurrency(context.storeMetrics.aov30d) },
  ];

  const analysis = analyzeSalesTrends(context.salesTrends);
  let narrative: string | undefined;
  if (!analysis.hasSufficientHistory) {
    narrative = "Limited sales history — trend comparisons may be incomplete.";
  } else if (analysis.weekOverWeek?.direction === "up") {
    narrative = "Revenue is trending up week over week.";
  } else if (analysis.weekOverWeek?.direction === "down") {
    narrative = "Revenue declined week over week — prioritize high-confidence recovery actions.";
  }

  return { id: "revenue_trend", title: "Revenue trend", metrics, narrative };
}

function buildInventorySection(
  context: BusinessContext,
  rec?: Recommendation,
  opp?: Opportunity,
): EvidenceSection {
  const titleHint = rec?.title ?? opp?.title ?? "";
  const lowMatch = context.lowStockProducts.find((p) => titleHint.includes(p.title));
  const slowMatch = context.slowProducts.find((p) => titleHint.includes(p.title));
  const topMatch = context.topProducts.find((p) => titleHint.includes(p.title));
  const sku = lowMatch ?? slowMatch ?? topMatch;

  if (sku) {
    const dailyVelocity =
      "unitsSold30d" in sku ? (sku as { unitsSold30d: number }).unitsSold30d / 30 : 0;
    const inventory = sku.inventory;
    const daysOfCover =
      "daysOfCover" in sku
        ? (sku as { daysOfCover: number }).daysOfCover
        : dailyVelocity > 0
          ? inventory / dailyVelocity
          : 999;

    return {
      id: "inventory_trend",
      title: "Inventory trend",
      metrics: [
        { label: "SKU", value: sku.title },
        { label: "Units on hand", value: String(inventory) },
        {
          label: "30-day units sold",
          value: "unitsSold30d" in sku ? String((sku as { unitsSold30d: number }).unitsSold30d) : "—",
          trend: dailyVelocity > 2 ? "up" : "flat",
        },
        { label: "Days of cover", value: daysOfCover.toFixed(1), trend: daysOfCover <= 7 ? "down" : "flat" },
      ],
      narrative: "Velocity vs. on-hand stock drives restock urgency.",
    };
  }

  const lowest = context.lowStockProducts[0];
  const metrics: SupportingMetric[] = [
    { label: "Total inventory units", value: String(context.inventoryUnits) },
    { label: "Products tracked", value: String(context.productCount) },
  ];
  if (lowest) {
    metrics.push(
      { label: "Lowest days of cover", value: lowest.daysOfCover.toFixed(1), trend: "down" },
      { label: "SKU at risk", value: lowest.title },
    );
  }

  return {
    id: "inventory_trend",
    title: "Inventory trend",
    metrics,
    narrative: "Store-wide inventory health across tracked SKUs.",
  };
}

function buildCampaignSection(
  context: BusinessContext,
  rec?: Recommendation,
  opp?: Opportunity,
): EvidenceSection | null {
  if (!context.hasActiveAdsConnector) return null;

  const titleHint = rec?.title ?? opp?.title ?? "";
  const campaign =
    context.campaigns.find((c) => titleHint.toLowerCase().includes(c.name.toLowerCase())) ??
    context.campaigns[0];

  if (!campaign) {
    return {
      id: "campaign_metrics",
      title: "Campaign metrics",
      metrics: [{ label: "Campaigns connected", value: "0 active with data" }],
      narrative: "No active campaigns with delivery data yet.",
    };
  }

  return {
    id: "campaign_metrics",
    title: "Campaign metrics",
    metrics: [
      { label: "Campaign", value: campaign.name },
      {
        label: "ROAS (7d)",
        value: campaign.roas7d.toFixed(2),
        trend: campaign.roas7d >= 2 ? "up" : "down",
      },
      { label: "7-day spend", value: formatCurrency(campaign.spend7d) },
      { label: "7-day revenue", value: formatCurrency(campaign.revenue7d) },
      { label: "Frequency (7d)", value: campaign.frequency7d.toFixed(1) },
    ],
    narrative: `Status: ${campaign.effectiveStatus}. Metrics reflect last 7 days of delivery.`,
  };
}

function buildCustomerSection(context: BusinessContext): EvidenceSection {
  return {
    id: "customer_metrics",
    title: "Customer metrics",
    metrics: [
      { label: "Orders (30d)", value: String(context.storeMetrics.orders30d) },
      { label: "AOV (30d)", value: formatCurrency(context.storeMetrics.aov30d) },
      { label: "Conversion rate", value: `${context.storeMetrics.conversionRate30d}%` },
      { label: "Collections", value: String(context.collectionCount) },
    ],
    narrative: "Store-level demand signals for retention and merchandising.",
  };
}

function kpisForCategory(
  category: Recommendation["category"] | Opportunity["category"],
): string[] {
  const map: Record<string, string[]> = {
    low_inventory: ["Days of cover", "Units sold (30d)", "Inventory on hand", "SKU revenue (30d)"],
    slow_selling: ["Price", "Units sold (30d)", "Inventory on hand", "Sell-through rate"],
    bundle_opportunity: ["Bundle SKU revenue", "Store AOV", "Orders (30d)"],
    homepage_merchandising: ["Collection revenue", "Homepage placement", "Conversion rate"],
    promotion_opportunity: ["Repeat demand", "Units sold (30d)", "Inventory buffer"],
    campaign_review: ["ROAS (7d)", "Spend (7d)", "Revenue (7d)", "Frequency (7d)"],
    inventory: ["Days of cover", "Units sold (30d)", "Inventory on hand"],
    pricing: ["Price", "Units sold (30d)", "Revenue (30d)"],
    bundle: ["Bundle SKUs", "Store AOV", "Orders (30d)"],
    merchandising: ["Collection revenue", "Conversion rate"],
    marketing: ["ROAS (7d)", "Spend (7d)", "Frequency (7d)"],
    customer_retention: ["Units sold (30d)", "Repeat demand", "Inventory on hand"],
  };
  return map[category] ?? ["Revenue (30d)", "Orders (30d)", "AOV (30d)"];
}

async function buildDataFreshness(
  context: BusinessContext,
  storeId: string,
): Promise<DataFreshness> {
  const { getDataSourceStatuses } = await import("@/lib/connectors/registry");
  const sources = await getDataSourceStatuses(storeId);
  return {
    lastSyncedAt: context.syncedAt,
    sources: sources.map((s) => ({
      label: s.label,
      status: s.status,
      lastSyncAt: s.lastSyncAt,
    })),
  };
}

function mapOpportunityCategory(
  category?: Opportunity["category"],
): Recommendation["category"] | undefined {
  if (!category) return undefined;
  const map: Record<Opportunity["category"], Recommendation["category"]> = {
    inventory: "low_inventory",
    pricing: "slow_selling",
    bundle: "bundle_opportunity",
    merchandising: "homepage_merchandising",
    marketing: "campaign_review",
    advertising_efficiency: "campaign_review",
    product_growth: "promotion_opportunity",
    marketing_attribution: "campaign_review",
    customer_retention: "promotion_opportunity",
  };
  return map[category];
}

export async function buildRecommendationEvidence(
  context: BusinessContext,
  input: {
    recommendation?: Recommendation;
    opportunity?: Opportunity;
  },
): Promise<RecommendationEvidence> {
  const rec = input.recommendation;
  const opp = input.opportunity;

  const title = rec?.title ?? opp?.title ?? "Recommendation";
  const category = rec?.category ?? opp?.category ?? "inventory";
  const confidenceScore = rec?.confidenceScore ?? opp?.confidenceScore ?? 0.5;
  const supportingMetrics = rec?.supportingMetrics ?? opp?.evidence ?? [];

  const explanation = rec
    ? explainRecommendation(rec)
    : {
        confidenceBreakdown: `Confidence ${Math.round(confidenceScore * 100)}% from opportunity engine thresholds and supporting SKU/campaign signals.`,
        confidenceScore,
      };

  const sections: EvidenceSection[] = [
    buildRevenueSection(context),
    buildInventorySection(context, rec, opp),
    buildCustomerSection(context),
  ];

  const campaignSection = buildCampaignSection(context, rec, opp);
  if (campaignSection) {
    sections.splice(2, 0, campaignSection);
  }

  const stats = await getCategoryLearningStats(context.storeId);
  const recCategory = rec?.category ?? mapOpportunityCategory(opp?.category);
  const measuredHistoricalNote = recCategory
    ? getHistoricalAccuracyNote(stats, recCategory)
    : undefined;

  return {
    recommendationId: rec?.id,
    opportunityId: opp?.id,
    title,
    kpisUsed: kpisForCategory(category),
    historicalComparisons: buildHistoricalComparisons(context),
    confidenceExplanation: explanation.confidenceBreakdown,
    confidenceScore,
    supportingMetrics,
    sections,
    dataFreshness: await buildDataFreshness(context, context.storeId),
    measuredHistoricalNote,
  };
}

export function findOpportunity(
  context: BusinessContext,
  opportunityId: string,
): Opportunity | undefined {
  return context.topOpportunities.find((o) => o.id === opportunityId);
}
