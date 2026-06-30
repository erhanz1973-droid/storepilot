import { getActiveCampaigns } from "@/lib/meta/campaign-stats";
import type { StoreSnapshot } from "@/lib/connectors/types";
import type { MeasurementKpis, Recommendation, RecommendationCategory } from "@/lib/types";
import type { OutcomeDisplayMetric } from "./outcome-types";

export function captureKpisForRecommendation(
  snapshot: StoreSnapshot,
  rec: Recommendation,
): MeasurementKpis {
  const base: MeasurementKpis = {
    revenue30d: snapshot.storeMetrics.revenue30d,
    orders30d: snapshot.storeMetrics.orders30d,
    aov30d: snapshot.storeMetrics.aov30d,
    conversionRate30d: snapshot.storeMetrics.conversionRate30d,
  };

  if (rec.entityType === "product" && rec.entityId) {
    const product = snapshot.products.find((p) => p.id === rec.entityId);
    if (product) {
      return {
        ...base,
        revenue30d: product.revenue30d,
        unitsSold30d: product.unitsSold30d,
        inventoryQuantity: product.inventoryQuantity,
      };
    }
  }

  if (rec.entityType === "campaign" && rec.entityId) {
    const campaign = getActiveCampaigns(snapshot.campaigns).find(
      (c) => c.id === rec.entityId,
    );
    if (campaign) {
      return {
        ...base,
        roas7d: campaign.roas7d,
        ctr7d: campaign.ctr7d,
        spend7d: campaign.spend7d,
        revenue7d: campaign.revenue7d,
      };
    }
  }

  if (rec.entityType === "collection" && rec.entityId) {
    const collection = snapshot.collections.find((c) => c.id === rec.entityId);
    if (collection) {
      return {
        ...base,
        revenue30d: collection.revenue30d,
      };
    }
  }

  if (rec.category === "bundle_opportunity") {
    const bundleProducts = snapshot.products.filter((p) =>
      p.tags.includes("bundle-candidate"),
    );
    const bundleRevenue = bundleProducts.reduce((s, p) => s + p.revenue30d, 0);
    return { ...base, revenue30d: bundleRevenue };
  }

  return base;
}

export type KpiDelta = {
  label: string;
  before: string;
  after: string;
  changePct: number | null;
  improved: boolean;
};

function pctChange(before: number, after: number): number | null {
  if (before === 0) return after > 0 ? 100 : 0;
  return ((after - before) / before) * 100;
}

export function compareKpis(
  category: RecommendationCategory,
  before: MeasurementKpis,
  after: MeasurementKpis,
): KpiDelta[] {
  const deltas: KpiDelta[] = [];

  const add = (
    label: string,
    b: number | undefined,
    a: number | undefined,
    higherIsBetter = true,
  ) => {
    if (b === undefined || a === undefined) return;
    const change = pctChange(b, a);
    deltas.push({
      label,
      before: formatKpi(label, b),
      after: formatKpi(label, a),
      changePct: change,
      improved: change === null ? false : higherIsBetter ? change > 0 : change < 0,
    });
  };

  switch (category) {
    case "low_inventory":
      add("Revenue (30d)", before.revenue30d, after.revenue30d);
      add("Units sold (30d)", before.unitsSold30d, after.unitsSold30d);
      add("Inventory on hand", before.inventoryQuantity, after.inventoryQuantity, true);
      break;
    case "campaign_review":
      add("ROAS (7d)", before.roas7d, after.roas7d);
      add("CTR (7d)", before.ctr7d, after.ctr7d);
      add("Ad revenue (7d)", before.revenue7d, after.revenue7d);
      break;
    case "bundle_opportunity":
      add("AOV (30d)", before.aov30d, after.aov30d);
      add("Bundle SKU revenue (30d)", before.revenue30d, after.revenue30d);
      add("Orders (30d)", before.orders30d, after.orders30d);
      break;
    case "slow_selling":
      add("Revenue (30d)", before.revenue30d, after.revenue30d);
      add("Units sold (30d)", before.unitsSold30d, after.unitsSold30d);
      add("Conversion rate", before.conversionRate30d, after.conversionRate30d);
      break;
    case "promotion_opportunity":
      add("Units sold (30d)", before.unitsSold30d, after.unitsSold30d);
      add("Revenue (30d)", before.revenue30d, after.revenue30d);
      add("Returning orders proxy", before.orders30d, after.orders30d);
      break;
    case "homepage_merchandising":
      add("Collection revenue (30d)", before.revenue30d, after.revenue30d);
      add("Store conversion rate", before.conversionRate30d, after.conversionRate30d);
      add("Store revenue (30d)", before.revenue30d, after.revenue30d);
      break;
    default:
      add("Revenue (30d)", before.revenue30d, after.revenue30d);
      add("Orders (30d)", before.orders30d, after.orders30d);
  }

  return deltas;
}

function formatKpi(label: string, value: number): string {
  if (label.includes("ROAS") || label.includes("rate") || label.includes("CTR")) {
    return label.includes("CTR") ? `${value.toFixed(2)}%` : value.toFixed(2);
  }
  if (label.includes("Revenue") || label.includes("AOV")) {
    return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  }
  return String(Math.round(value));
}

export function estimateActualMonthlyImpact(
  category: RecommendationCategory,
  before: MeasurementKpis,
  after: MeasurementKpis,
): number {
  switch (category) {
    case "low_inventory": {
      const revDelta = (after.revenue30d ?? 0) - (before.revenue30d ?? 0);
      const stockoutPrevented =
        (before.inventoryQuantity ?? 0) <= 5 && (after.inventoryQuantity ?? 0) > 10;
      return Math.max(0, Math.round(revDelta + (stockoutPrevented ? (after.revenue30d ?? 0) * 0.05 : 0)));
    }
    case "campaign_review": {
      const revDelta = (after.revenue7d ?? 0) - (before.revenue7d ?? 0);
      return Math.max(0, Math.round(revDelta * 4.33));
    }
    case "bundle_opportunity": {
      const aovDelta = (after.aov30d ?? 0) - (before.aov30d ?? 0);
      const orders = after.orders30d ?? 0;
      return Math.max(0, Math.round(aovDelta * orders));
    }
    case "slow_selling": {
      const revDelta = (after.revenue30d ?? 0) - (before.revenue30d ?? 0);
      return Math.max(0, Math.round(revDelta));
    }
    case "promotion_opportunity": {
      const unitsDelta = (after.unitsSold30d ?? 0) - (before.unitsSold30d ?? 0);
      const avgPrice =
        (after.revenue30d ?? 0) / Math.max(after.unitsSold30d ?? 1, 1);
      return Math.max(0, Math.round(unitsDelta * avgPrice));
    }
    case "homepage_merchandising": {
      const revDelta = (after.revenue30d ?? 0) - (before.revenue30d ?? 0);
      const convDelta =
        ((after.conversionRate30d ?? 0) - (before.conversionRate30d ?? 0)) / 100;
      const storeRev = after.revenue30d ?? 0;
      return Math.max(0, Math.round(revDelta + storeRev * convDelta * 0.5));
    }
    default:
      return Math.max(
        0,
        Math.round((after.revenue30d ?? 0) - (before.revenue30d ?? 0)),
      );
  }
}

export function buildOutcomeSummary(
  category: RecommendationCategory,
  deltas: KpiDelta[],
): string {
  const improved = deltas.filter((d) => d.improved);
  const lines: string[] = [];

  for (const d of improved.slice(0, 3)) {
    if (d.changePct !== null) {
      const dir = d.changePct >= 0 ? "increased" : "decreased";
      lines.push(`${d.label} ${dir} ${Math.abs(d.changePct).toFixed(0)}%`);
    }
  }

  if (category === "low_inventory") {
    const inv = deltas.find((d) => d.label.includes("Inventory"));
    if (inv && inv.improved) {
      lines.push("Stock levels replenished — stockout risk reduced");
    }
  }

  if (lines.length === 0) {
    return "Metrics within expected variance for the measurement window.";
  }

  return lines.join(". ") + ".";
}

export function computePredictionAccuracy(
  expectedMonthly: number,
  actualMonthly: number,
): number {
  if (expectedMonthly <= 0) {
    return actualMonthly > 0 ? 100 : 0;
  }
  const ratio = actualMonthly / expectedMonthly;
  const accuracy = Math.min(100, Math.round(ratio * 100));
  return Math.max(0, accuracy);
}

export const CATEGORY_LABELS: Record<RecommendationCategory, string> = {
  low_inventory: "Inventory",
  slow_selling: "Pricing",
  bundle_opportunity: "Bundle",
  homepage_merchandising: "Merchandising",
  promotion_opportunity: "Retention",
  campaign_review: "Marketing",
};

export function actionTypeToCategory(actionType?: string | null): RecommendationCategory {
  switch (actionType) {
    case "pause_campaign":
    case "increase_budget":
    case "decrease_budget":
    case "reduce_budget":
    case "scale_campaign":
    case "enable_campaign":
      return "campaign_review";
    case "create_automatic_discount":
    case "create_discount":
    case "create_discount_code":
    case "unpublish_product":
      return "slow_selling";
    case "create_bundle":
    case "create_promotion":
      return "bundle_opportunity";
    case "add_to_collection":
    case "publish_product":
      return "homepage_merchandising";
    default:
      return "promotion_opportunity";
  }
}

export function captureKpisForEntity(
  snapshot: StoreSnapshot,
  entityType?: string | null,
  entityId?: string | null,
): MeasurementKpis {
  const fakeRec = {
    entityType: entityType as Recommendation["entityType"],
    entityId: entityId ?? undefined,
    category: "promotion_opportunity" as RecommendationCategory,
  } as Recommendation;
  return captureKpisForRecommendation(snapshot, fakeRec);
}

export function compareKpisForAction(
  actionType: string | null | undefined,
  category: RecommendationCategory,
  before: MeasurementKpis,
  after: MeasurementKpis,
): KpiDelta[] {
  if (actionType === "pause_campaign") {
    const deltas: KpiDelta[] = [];
    const spendBefore = before.spend7d ?? 0;
    const spendAfter = after.spend7d ?? 0;
    const spendSaved = spendBefore - spendAfter;
    if (spendBefore > 0 || spendAfter > 0) {
      deltas.push({
        label: "Ad spend (7d)",
        before: `$${Math.round(spendBefore).toLocaleString()}`,
        after: `$${Math.round(spendAfter).toLocaleString()}`,
        changePct: spendBefore > 0 ? ((spendAfter - spendBefore) / spendBefore) * 100 : null,
        improved: spendAfter < spendBefore,
      });
      if (spendSaved > 0) {
        deltas.push({
          label: "Ad spend saved (7d)",
          before: "—",
          after: `$${Math.round(spendSaved).toLocaleString()}`,
          changePct: null,
          improved: true,
        });
      }
    }
    const revBefore = before.revenue7d ?? 0;
    const revAfter = after.revenue7d ?? 0;
    deltas.push({
      label: "Ad revenue (7d)",
      before: `$${Math.round(revBefore).toLocaleString()}`,
      after: `$${Math.round(revAfter).toLocaleString()}`,
      changePct: revBefore > 0 ? ((revAfter - revBefore) / revBefore) * 100 : null,
      improved: revAfter >= revBefore * 0.9,
    });
    return deltas.length > 0 ? deltas : compareKpis(category, before, after);
  }

  if (
    actionType === "create_automatic_discount" ||
    actionType === "create_discount" ||
    actionType === "create_discount_code"
  ) {
    const deltas = compareKpis("slow_selling", before, after);
    const unitsBefore = before.unitsSold30d ?? 0;
    const unitsAfter = after.unitsSold30d ?? 0;
    const unitsSold = unitsAfter - unitsBefore;
    if (unitsSold > 0) {
      deltas.unshift({
        label: "Inventory sold (window)",
        before: String(unitsBefore),
        after: String(unitsAfter),
        changePct: unitsBefore > 0 ? (unitsSold / unitsBefore) * 100 : 100,
        improved: true,
      });
    }
    const invAfter = after.inventoryQuantity;
    if (invAfter != null) {
      deltas.push({
        label: "Inventory remaining",
        before: String(before.inventoryQuantity ?? "—"),
        after: String(invAfter),
        changePct: null,
        improved: (before.inventoryQuantity ?? 0) > invAfter,
      });
    }
    return deltas;
  }

  return compareKpis(category, before, after);
}

export function buildAiVerdict(input: {
  actionType?: string | null;
  rating: import("./outcome-types").OutcomeRating;
  deltas: KpiDelta[];
  entityName?: string | null;
}): string {
  const improved = input.deltas.filter((d) => d.improved);
  const name = input.entityName ?? "the target";

  if (input.rating === "successful") {
    if (
      input.actionType === "create_automatic_discount" ||
      input.actionType === "create_discount" ||
      input.actionType === "create_discount_code"
    ) {
      return `The recommendation successfully reduced dead inventory on ${name} while maintaining profitability.`;
    }
    if (input.actionType === "pause_campaign") {
      return `Pausing ${name} reduced wasted ad spend without materially hurting revenue.`;
    }
    if (input.actionType === "create_bundle" || input.actionType === "create_promotion") {
      return `The bundle offer on ${name} lifted sales metrics within the measurement window.`;
    }
    return `StorePilot's action on ${name} produced measurable improvement across ${improved.length} key metrics.`;
  }

  if (input.rating === "needs_improvement") {
    return `Results for ${name} underperformed expectations. StorePilot will lower confidence on similar recommendations until more evidence is available.`;
  }

  return `Results for ${name} were mixed. Metrics moved within normal variance — continue monitoring before repeating this action.`;
}

export function buildOutcomeDisplayMetrics(
  actionType: string | null | undefined,
  deltas: KpiDelta[],
  actualMonthly: number,
): OutcomeDisplayMetric[] {
  const metrics: OutcomeDisplayMetric[] = [];

  for (const d of deltas.slice(0, 4)) {
    metrics.push({
      label: d.label,
      value: d.after,
      trend: d.improved ? "up" : d.changePct != null && d.changePct < 0 ? "down" : "neutral",
    });
  }

  if (metrics.length === 0 && actualMonthly !== 0) {
    metrics.push({
      label: "Monthly impact",
      value: `${actualMonthly >= 0 ? "+" : ""}$${Math.abs(actualMonthly).toLocaleString()}`,
      trend: actualMonthly > 0 ? "up" : "down",
    });
  }

  return metrics;
}

