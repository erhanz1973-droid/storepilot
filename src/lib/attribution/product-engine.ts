import { buildMarketingCampaigns } from "@/lib/analytics/marketing";
import type { StoreSnapshot } from "@/lib/connectors/types";
import type { ProductCostRecord } from "@/lib/db/product-costs";
import { productCostMap } from "@/lib/db/product-costs";
import {
  buildCampaignProductLinks,
  buildProductSourceRevenue,
} from "@/lib/attribution/product-mapping";
import {
  ATTRIBUTION_CONFIDENCE_LABELS,
  ATTRIBUTION_METHOD_LABELS,
  type AttributionMethod,
  type CampaignProductLink,
  type ProductAttributionConfidenceLevel,
  type ProductAttributionDashboard,
  type ProductAttributionProfile,
  type ProductAttributionWidget,
  type ProductCampaignAttribution,
  type ProductRevenueSources,
} from "@/lib/attribution/product-types";
import { resolveCostSource } from "@/lib/profit/cost-source";
import {
  DEFAULT_TRANSACTION_FEE_FIXED,
  DEFAULT_TRANSACTION_FEE_RATE,
  ESTIMATED_COGS_RATE,
} from "@/lib/profit/constants";
import type { ProfitDashboard } from "@/lib/profit/types";
import { allocateOrderCosts } from "@/lib/products/enrich";

const SCALE_30D = 30 / 7;

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

function confidenceLevel(pct: number): ProductAttributionConfidenceLevel {
  if (pct >= 95) return "verified";
  if (pct >= 80) return "high";
  if (pct >= 60) return "estimated";
  if (pct > 0) return "low";
  return "unknown";
}

function methodConfidence(method: AttributionMethod): number {
  switch (method) {
    case "direct_purchase":
      return 98;
    case "campaign_attribution":
      return 85;
    case "revenue_allocation":
      return 68;
    case "equal_distribution":
      return 55;
    default:
      return 0;
  }
}

type CampaignRow = {
  id: string;
  name: string;
  channel: "meta" | "google" | "tiktok";
  spend30d: number;
  revenue30d: number;
};

function collectCampaigns(snapshot: StoreSnapshot): CampaignRow[] {
  const rows: CampaignRow[] = [];
  for (const c of buildMarketingCampaigns(snapshot)) {
    if (c.channel === "pinterest") continue;
    rows.push({
      id: c.id,
      name: c.campaign,
      channel: c.channel,
      spend30d: round(c.spend * SCALE_30D),
      revenue30d: round(c.revenue * SCALE_30D),
    });
  }
  return rows;
}

function distributeAmongProducts(
  amount: number,
  productIds: string[],
  products: StoreSnapshot["products"],
  weightFn: (p: StoreSnapshot["products"][0]) => number,
): Map<string, number> {
  const result = new Map<string, number>();
  const eligible = products.filter((p) => productIds.includes(p.id));
  const totalWeight = eligible.reduce((s, p) => s + weightFn(p), 0);
  if (totalWeight <= 0 || amount === 0) return result;
  for (const p of eligible) {
    result.set(p.id, round((amount * weightFn(p)) / totalWeight));
  }
  return result;
}

function buildAdAttribution(
  snapshot: StoreSnapshot,
  campaignLinks: CampaignProductLink[],
  campaigns: CampaignRow[],
): {
  metaSpend: Map<string, number>;
  googleSpend: Map<string, number>;
  campaignRows: Map<string, ProductCampaignAttribution[]>;
  methods: Map<string, { method: AttributionMethod; confidencePct: number }>;
} {
  const metaSpend = new Map<string, number>();
  const googleSpend = new Map<string, number>();
  const campaignRows = new Map<string, ProductCampaignAttribution[]>();
  const methods = new Map<string, { method: AttributionMethod; confidencePct: number }>();
  const linkByCampaign = new Map(campaignLinks.map((l) => [l.campaignId, l]));

  const addSpend = (channel: "meta" | "google" | "tiktok", productId: string, amount: number) => {
    const map = channel === "google" ? googleSpend : metaSpend;
    map.set(productId, round((map.get(productId) ?? 0) + amount));
  };

  const assignedCampaignIds = new Set<string>();

  for (const campaign of campaigns) {
    const link = linkByCampaign.get(campaign.id);
    if (!link || link.productIds.length === 0) continue;

    const method = link.method === "unknown" ? "campaign_attribution" : link.method;
    const conf = Math.max(link.confidencePct, methodConfidence(method));
    const spendSplit = distributeAmongProducts(
      campaign.spend30d,
      link.productIds,
      snapshot.products,
      (p) => p.revenue30d,
    );
    const revenueSplit = distributeAmongProducts(
      campaign.revenue30d,
      link.productIds,
      snapshot.products,
      (p) => p.revenue30d,
    );

    assignedCampaignIds.add(campaign.id);

    for (const productId of link.productIds) {
      const spend = spendSplit.get(productId) ?? 0;
      const rev = revenueSplit.get(productId) ?? 0;
      if (spend <= 0 && rev <= 0) continue;

      addSpend(campaign.channel, productId, spend);

      const rows = campaignRows.get(productId) ?? [];
      rows.push({
        campaignId: campaign.id,
        campaignName: campaign.name,
        channel: campaign.channel,
        attributedRevenue: rev,
        attributedSpend: spend,
        method,
        confidencePct: conf,
      });
      campaignRows.set(productId, rows);

      const prev = methods.get(productId);
      if (!prev || conf > prev.confidencePct) {
        methods.set(productId, { method, confidencePct: conf });
      }
    }
  }

  const totalAssignedSpend = [...metaSpend.values(), ...googleSpend.values()].reduce(
    (a, b) => a + b,
    0,
  );
  const totalAdSpend = campaigns.reduce((s, c) => s + c.spend30d, 0);
  const unassigned = Math.max(0, round(totalAdSpend - totalAssignedSpend));

  if (unassigned > 0) {
    const storeRevenue = snapshot.storeMetrics.revenue30d;
    for (const p of snapshot.products) {
      if (p.revenue30d <= 0) continue;
      const share = p.revenue30d / Math.max(1, storeRevenue);
      const extra = round(unassigned * share);
      if (extra <= 0) continue;
      addSpend("meta", p.id, extra * 0.7);
      addSpend("google", p.id, extra * 0.3);
      const prev = methods.get(p.id);
      if (!prev || prev.confidencePct < 68) {
        methods.set(p.id, { method: "revenue_allocation", confidencePct: 68 });
      }
    }
  }

  return { metaSpend, googleSpend, campaignRows, methods };
}

function fillOrganicResidual(
  product: StoreSnapshot["products"][0],
  sources: ProductRevenueSources,
): ProductRevenueSources {
  const attributed =
    sources.meta + sources.google + sources.direct + sources.email + sources.referral;
  const organic = Math.max(0, round(product.revenue30d - attributed));
  return { ...sources, organic };
}

function primarySource(sources: ProductRevenueSources): string {
  const entries: [string, number][] = [
    ["Meta Ads", sources.meta],
    ["Google Ads", sources.google],
    ["Organic", sources.organic],
    ["Direct", sources.direct],
    ["Email", sources.email],
    ["Referral", sources.referral],
  ];
  entries.sort((a, b) => b[1] - a[1]);
  return entries[0]![1] > 0 ? entries[0]![0]! : "Unknown";
}

function buildRecommendation(
  profile: Pick<
    ProductAttributionProfile,
    "netProfit" | "marginPct" | "roas" | "sources" | "adCost" | "losingMoney"
  >,
): string {
  const metaSpend = profile.adCost.metaSpend ?? 0;
  const organic = profile.sources.organic;
  const paidRevenue = profile.sources.meta + profile.sources.google;

  if (profile.losingMoney && metaSpend > 0 && organic > paidRevenue) {
    return "Profitable via organic — reduce or pause Meta promotion";
  }
  if (profile.losingMoney && metaSpend > 0) {
    return "Losing money when advertised — pause paid promotion";
  }
  if ((profile.roas ?? 0) >= 3 && profile.marginPct >= 25) {
    return "Strong ROAS — increase ad budget";
  }
  if (profile.sources.google > profile.sources.meta && (profile.roas ?? 0) >= 2) {
    return "Google Shopping performs well — scale Google budget";
  }
  const totalRevenue =
    profile.sources.organic +
    profile.sources.meta +
    profile.sources.google +
    profile.sources.direct +
    profile.sources.email +
    profile.sources.referral;
  if (organic > totalRevenue * 0.6 && profile.netProfit > 0) {
    return "Organic-driven — focus on SEO and retention";
  }
  if (profile.marginPct < 20) {
    return "Low margin — test price increase before more ads";
  }
  return "Monitor channel mix and margin";
}

function widget(
  id: string,
  label: string,
  products: ProductAttributionProfile[],
  valueFn: (p: ProductAttributionProfile) => number,
  sublabelFn?: (p: ProductAttributionProfile) => string,
  limit = 5,
): ProductAttributionWidget {
  return {
    id,
    label,
    products: [...products]
      .sort((a, b) => valueFn(b) - valueFn(a))
      .slice(0, limit)
      .map((p) => ({
        productId: p.productId,
        title: p.title,
        value: valueFn(p),
        sublabel: sublabelFn?.(p),
      })),
  };
}

export function buildProductAttributionDashboard(
  snapshot: StoreSnapshot,
  costRecords: ProductCostRecord[],
  profitDashboard: ProfitDashboard | null,
): ProductAttributionDashboard | null {
  if (!snapshot.profitRollups) return null;

  const costs = productCostMap(costRecords);
  const rollups = snapshot.profitRollups.last30d;
  const storeRevenue = rollups.revenue;
  const transactionFees = round(
    rollups.revenue * DEFAULT_TRANSACTION_FEE_RATE +
      rollups.orders * DEFAULT_TRANSACTION_FEE_FIXED,
  );
  const storeCosts = {
    shipping: rollups.shipping,
    transactionFees,
    adSpend: profitDashboard?.primary.adSpend ?? 0,
  };

  const campaignLinks = buildCampaignProductLinks(snapshot);
  const campaigns = collectCampaigns(snapshot);
  const sourceRevenueMap = buildProductSourceRevenue(snapshot);
  const { metaSpend, googleSpend, campaignRows, methods } = buildAdAttribution(
    snapshot,
    campaignLinks,
    campaigns,
  );

  const products: ProductAttributionProfile[] = snapshot.products
    .filter((p) => p.unitsSold30d > 0 || p.revenue30d > 0)
    .map((p) => {
      const costSource = resolveCostSource(p, costs);
      const unitCost =
        costSource === "shopify" && p.unitCost != null
          ? p.unitCost
          : costSource === "manual"
            ? costs.get(p.id)!.unitCost
            : round(p.price * ESTIMATED_COGS_RATE * 100) / 100;

      const cogs = round(unitCost * p.unitsSold30d);
      const allocated = allocateOrderCosts(p.revenue30d, storeRevenue, storeCosts);
      const meta = metaSpend.get(p.id) ?? 0;
      const google = googleSpend.get(p.id) ?? 0;
      const totalAd = round(meta + google);
      const attrMeta = methods.get(p.id);
      const method = attrMeta?.method ?? (totalAd > 0 ? "revenue_allocation" : "unknown");
      const confidencePct =
        totalAd > 0 ? (attrMeta?.confidencePct ?? methodConfidence(method)) : 0;

      const grossProfit = round(p.revenue30d - cogs);
      const netProfit = round(
        p.revenue30d - cogs - allocated.shipping - allocated.transactionFees - totalAd,
      );
      const marginPct =
        p.revenue30d > 0 ? round((netProfit / p.revenue30d) * 1000) / 10 : 0;
      const roas = totalAd > 0 ? round((p.revenue30d / totalAd) * 100) / 100 : null;

      const sources = fillOrganicResidual(
        p,
        sourceRevenueMap.get(p.id) ?? {
          meta: 0,
          google: 0,
          organic: 0,
          direct: 0,
          email: 0,
          referral: 0,
        },
      );

      const adCost = {
        metaSpend: meta > 0 ? meta : null,
        googleSpend: google > 0 ? google : null,
        totalSpend: totalAd > 0 ? totalAd : null,
        isEstimated: method === "revenue_allocation" || method === "equal_distribution",
        isUnknown: totalAd === 0 && storeCosts.adSpend > 0,
      };

      return {
        productId: p.id,
        title: p.title,
        imageUrl: p.imageUrl ?? null,
        revenue: p.revenue30d,
        adCost,
        cogs,
        shippingCost: allocated.shipping,
        paymentFees: allocated.transactionFees,
        grossProfit,
        netProfit,
        marginPct,
        roas,
        unitsSold: p.unitsSold30d,
        inventory: p.inventoryQuantity,
        confidencePct,
        confidenceLevel: confidenceLevel(confidencePct),
        method,
        methodLabel: ATTRIBUTION_METHOD_LABELS[method],
        primaryTrafficSource: primarySource(sources),
        recommendation: "",
        sources,
        campaigns: campaignRows.get(p.id) ?? [],
        costSource,
        losingMoney: netProfit < 0,
      };
    })
    .map((p) => ({ ...p, recommendation: buildRecommendation(p) }))
    .sort((a, b) => b.netProfit - a.netProfit);

  const overallConfidencePct =
    products.length > 0
      ? Math.round(products.reduce((s, p) => s + p.confidencePct, 0) / products.length)
      : 0;

  const byProductId = Object.fromEntries(products.map((p) => [p.productId, p]));

  return {
    syncedAt: snapshot.syncedAt,
    products,
    byProductId,
    overallConfidencePct,
    widgets: {
      topByProfit: widget("top-profit", "Top Products by Profit", products, (p) => p.netProfit),
      topByRoas: widget(
        "top-roas",
        "Top Products by ROAS",
        products.filter((p) => p.roas != null),
        (p) => p.roas ?? 0,
        (p) => `ROAS ${p.roas?.toFixed(2)}`,
      ),
      topByOrganic: widget(
        "top-organic",
        "Top Products by Organic Revenue",
        products,
        (p) => p.sources.organic,
      ),
      mostExpensiveToAdvertise: widget(
        "expensive-ads",
        "Most Expensive Products to Advertise",
        products.filter((p) => (p.adCost.totalSpend ?? 0) > 0),
        (p) => p.adCost.totalSpend ?? 0,
        (p) =>
          p.adCost.isEstimated
            ? "Estimated"
            : p.adCost.isUnknown
              ? "Unknown"
              : ATTRIBUTION_CONFIDENCE_LABELS[p.confidenceLevel],
      ),
      losingMoney: widget(
        "losing",
        "Products Losing Money",
        products.filter((p) => p.losingMoney),
        (p) => Math.abs(p.netProfit),
        (p) => `-${Math.abs(p.netProfit).toLocaleString()} net`,
      ),
      highestAdCost: widget(
        "highest-ad",
        "Highest Advertising Cost",
        products.filter((p) => (p.adCost.totalSpend ?? 0) > 0),
        (p) => p.adCost.totalSpend ?? 0,
      ),
      highestMargin: widget(
        "highest-margin",
        "Highest Profit Margin",
        products.filter((p) => p.netProfit > 0),
        (p) => p.marginPct,
        (p) => `${p.marginPct}%`,
      ),
    },
  };
}

/** AI context summary with attribution transparency */
export function summarizeProductAttributionForAi(
  dashboard: ProductAttributionDashboard,
): string {
  const top = dashboard.products[0];
  const losing = dashboard.products.filter((p) => p.losingMoney).slice(0, 2);
  const lines = [
    `Product attribution confidence: ${dashboard.overallConfidencePct}% average across ${dashboard.products.length} SKUs.`,
  ];
  if (top) {
    lines.push(
      `Top attributed profit: ${top.title} — $${top.netProfit.toLocaleString()} net (${top.methodLabel}, ${top.confidencePct}% confidence). Primary source: ${top.primaryTrafficSource}.`,
    );
  }
  for (const p of losing) {
    const adNote = p.adCost.isEstimated
      ? "estimated ad cost"
      : p.adCost.isUnknown
        ? "unknown ad cost"
        : `$${(p.adCost.totalSpend ?? 0).toLocaleString()} ad spend`;
    lines.push(
      `Losing SKU: ${p.title} — $${p.netProfit.toLocaleString()} net (${adNote}, ${p.methodLabel}). ${p.recommendation}`,
    );
  }
  return lines.join(" ");
}

export function getProductAttribution(
  dashboard: ProductAttributionDashboard | null | undefined,
  productId: string,
): ProductAttributionProfile | null {
  if (!dashboard) return null;
  return dashboard.byProductId[productId] ?? null;
}

export type CampaignAttributedProduct = {
  productId: string;
  title: string;
  attributedSpend: number;
  attributedRevenue: number;
  confidencePct: number;
  methodLabel: string;
};

export function getCampaignAttributedProducts(
  dashboard: ProductAttributionDashboard,
  campaignId: string,
): CampaignAttributedProduct[] {
  const results: CampaignAttributedProduct[] = [];
  for (const product of dashboard.products) {
    const match = product.campaigns.find((c) => c.campaignId === campaignId);
    if (!match) continue;
    results.push({
      productId: product.productId,
      title: product.title,
      attributedSpend: match.attributedSpend,
      attributedRevenue: match.attributedRevenue,
      confidencePct: match.confidencePct,
      methodLabel: product.methodLabel,
    });
  }
  return results.sort((a, b) => b.attributedSpend - a.attributedSpend);
}
