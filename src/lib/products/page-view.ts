import type { ProductAttributionDashboard, ProductAttributionProfile } from "@/lib/attribution/product-types";
import { ATTRIBUTION_METHOD_LABELS } from "@/lib/attribution/product-types";
import type { ProfitDashboard } from "@/lib/profit/types";
import {
  deriveProductRecommendation,
  displayStatus,
  healthTier,
  type ProductDisplayStatus,
  type ProductHealthTier,
  type ProductRecommendation,
  type ProductRecommendationBadge,
} from "@/lib/products/recommendations";
import { buildMerchandisingInsights } from "@/lib/products/insights";
import type {
  ProductIntelligenceDashboard,
  ProductIntelligenceProfile,
  ProductMerchandisingInsight,
  ProductLifecycleStage,
  ProductHealthFactor,
} from "@/lib/products/types";
import {
  collectionTitleForProduct,
  findRelatedProducts,
  inventoryHistoryForProduct,
  productSkuFromId,
  recentOrdersForProduct,
  type ProductInventoryPoint,
  type ProductRecentOrder,
  type ProductRelatedItem,
} from "@/lib/products/catalog-enrichment";
import type { StoreSnapshot } from "@/lib/connectors/types";

export type ProductRecoveryOpportunity = {
  id: string;
  badge: ProductRecommendationBadge;
  title: string;
  productId: string;
  productTitle: string;
  estimatedMonthlyImpact: number;
  reasoning: string[];
  action: string;
  explanation: string;
};

export type ProductsExecutiveSummary = {
  totalProducts: number;
  activeProducts: number;
  profitable: number;
  losingMoney: number;
  outOfStock: number;
  deadInventory: number;
  highestProfitProduct: { title: string; netProfit: number } | null;
  biggestOpportunity: {
    title: string;
    productTitle: string;
    estimatedMonthlyImpact: number;
  } | null;
};

export type EnrichedProductCard = ProductIntelligenceProfile & {
  sku: string;
  collectionTitle: string;
  relatedProducts: ProductRelatedItem[];
  recentOrders: ProductRecentOrder[];
  inventoryHistory: ProductInventoryPoint[];
  displayStatus: ProductDisplayStatus;
  healthTier: ProductHealthTier;
  recommendation: ProductRecommendation;
  merchandisingInsights: ProductMerchandisingInsight[];
  attribution: ProductAttributionProfile | null;
  attributionMethodLabel: string;
  attributionConfidencePct: number;
  profitConfidenceLabel: string;
  profitConfidencePct: number;
  metaRevenue: number;
  googleRevenue: number;
  organicRevenue: number;
  emailRevenue: number;
  directRevenue: number;
  metaSpend: number | null;
  googleSpend: number | null;
  adCostEstimated: boolean;
  isOrganicWinner: boolean;
  isAdvertisingWinner: boolean;
  isAdvertisingLoser: boolean;
};

export type ProductFilterId =
  | "all"
  | "most_profitable"
  | "highest_roas"
  | "highest_margin"
  | "fastest_growing"
  | "inventory_risk"
  | "dead_inventory"
  | "losing_money"
  | "organic_winners"
  | "advertising_winners"
  | "advertising_losers";

export const PRODUCT_FILTER_LABELS: Record<ProductFilterId, string> = {
  all: "All Products",
  most_profitable: "Most Profitable",
  highest_roas: "Highest ROAS",
  highest_margin: "Highest Margin",
  fastest_growing: "Fastest Growing",
  inventory_risk: "Inventory Risk",
  dead_inventory: "Dead Inventory",
  losing_money: "Losing Money",
  organic_winners: "Organic Winners",
  advertising_winners: "Advertising Winners",
  advertising_losers: "Advertising Losers",
};

export type ProductsPageView = {
  executiveSummary: ProductsExecutiveSummary;
  recovery: {
    totalMonthlyRecovery: number;
    opportunities: ProductRecoveryOpportunity[];
  };
  products: EnrichedProductCard[];
  allHealthy: boolean;
};

function profitConfidence(profile: ProductIntelligenceProfile): {
  label: string;
  pct: number;
} {
  if (profile.costSource === "shopify" || profile.costSource === "manual") {
    return { label: "Verified", pct: 100 };
  }
  return { label: "Estimated", pct: 70 };
}

function findBundlePartner(
  profile: ProductIntelligenceProfile,
  products: ProductIntelligenceProfile[],
): ProductIntelligenceProfile | undefined {
  return products.find(
    (other) =>
      other.productId !== profile.productId &&
      other.marginPct > 25 &&
      other.netProfit > 0 &&
      other.unitsSold >= 20,
  );
}

function enrichProduct(
  profile: ProductIntelligenceProfile,
  attr: ProductAttributionProfile | null,
  allProducts: ProductIntelligenceProfile[],
  snapshot: StoreSnapshot,
): EnrichedProductCard {
  const bundlePartner = findBundlePartner(profile, allProducts);
  const recommendation = deriveProductRecommendation(
    profile,
    attr,
    bundlePartner?.title,
  );
  const pc = profitConfidence(profile);
  const organic = attr?.sources.organic ?? 0;
  const paidRev = (attr?.sources.meta ?? 0) + (attr?.sources.google ?? 0);

  return {
    ...profile,
    sku: productSkuFromId(profile.productId),
    collectionTitle: collectionTitleForProduct(snapshot, profile.productId),
    relatedProducts: findRelatedProducts(profile, allProducts, snapshot),
    recentOrders: recentOrdersForProduct(snapshot, profile.productId),
    inventoryHistory: inventoryHistoryForProduct(profile),
    displayStatus: displayStatus(profile, attr),
    healthTier: healthTier(profile.healthScore),
    recommendation,
    merchandisingInsights: buildMerchandisingInsights(
      profile,
      attr,
      profile.lifecycleStage,
      bundlePartner?.title,
    ),
    attribution: attr,
    attributionMethodLabel: attr?.methodLabel ?? ATTRIBUTION_METHOD_LABELS.revenue_allocation,
    attributionConfidencePct: attr?.confidencePct ?? 0,
    profitConfidenceLabel: pc.label,
    profitConfidencePct: pc.pct,
    metaRevenue: attr?.sources.meta ?? 0,
    googleRevenue: attr?.sources.google ?? 0,
    organicRevenue: organic,
    emailRevenue: attr?.sources.email ?? 0,
    directRevenue: attr?.sources.direct ?? 0,
    metaSpend: attr?.adCost.metaSpend ?? null,
    googleSpend: attr?.adCost.googleSpend ?? null,
    adCostEstimated: attr?.adCost.isEstimated ?? true,
    isOrganicWinner: organic > paidRev && profile.netProfit > 0,
    isAdvertisingWinner:
      paidRev > 0 && (profile.productRoas ?? 0) >= 2 && profile.netProfit > 0,
    isAdvertisingLoser: profile.isLosingMoney && profile.adCost > profile.revenue * 0.1,
  };
}

export function filterProducts(
  products: EnrichedProductCard[],
  filter: ProductFilterId,
): EnrichedProductCard[] {
  switch (filter) {
    case "most_profitable":
      return [...products].sort((a, b) => b.netProfit - a.netProfit);
    case "highest_roas":
      return products
        .filter((p) => p.productRoas != null)
        .sort((a, b) => (b.productRoas ?? 0) - (a.productRoas ?? 0));
    case "highest_margin":
      return [...products].sort((a, b) => b.marginPct - a.marginPct);
    case "fastest_growing":
      return products
        .filter((p) => p.trends.revenueGrowthPct != null)
        .sort((a, b) => (b.trends.revenueGrowthPct ?? 0) - (a.trends.revenueGrowthPct ?? 0));
    case "inventory_risk":
      return products.filter((p) => p.inventoryRisk !== "none");
    case "dead_inventory":
      return products.filter(
        (p) => p.displayStatus === "Dead Inventory" || p.lifecycleStage === "Dead Inventory",
      );
    case "losing_money":
      return products.filter((p) => p.isLosingMoney);
    case "organic_winners":
      return products.filter((p) => p.isOrganicWinner);
    case "advertising_winners":
      return products.filter((p) => p.isAdvertisingWinner);
    case "advertising_losers":
      return products.filter((p) => p.isAdvertisingLoser);
    default:
      return products;
  }
}

export function assembleProductsPageView(
  intelligence: ProductIntelligenceDashboard,
  attribution: ProductAttributionDashboard | null,
  snapshot: StoreSnapshot,
  _profitDashboard?: ProfitDashboard | null,
): ProductsPageView {
  const products = intelligence.products.map((p) =>
    enrichProduct(p, attribution?.byProductId[p.productId] ?? null, intelligence.products, snapshot),
  );

  const activeProducts = products.filter((p) => !p.catalogOnly).length;
  const profitable = products.filter((p) => p.netProfit > 0).length;
  const losingMoney = products.filter((p) => p.isLosingMoney).length;
  const outOfStock = products.filter((p) => p.displayStatus === "Out of Stock").length;
  const deadInventory = products.filter(
    (p) => p.displayStatus === "Dead Inventory" || p.lifecycleStage === "Dead Inventory",
  ).length;
  const highest = [...products].sort((a, b) => b.netProfit - a.netProfit)[0] ?? null;

  const recoveryCandidates = products
    .filter(
      (p) =>
        p.recommendation.expectedMonthlyImpact > 0 &&
        p.recommendation.badge !== "healthy",
    )
    .sort((a, b) => b.recommendation.expectedMonthlyImpact - a.recommendation.expectedMonthlyImpact);

  const opportunities: ProductRecoveryOpportunity[] = recoveryCandidates.slice(0, 8).map((p) => ({
    id: `recovery-${p.productId}`,
    badge: p.recommendation.badge,
    title: p.recommendation.label,
    productId: p.productId,
    productTitle: p.title,
    estimatedMonthlyImpact: p.recommendation.expectedMonthlyImpact,
    reasoning: p.recommendation.reasoning,
    action: p.recommendation.action,
    explanation: p.recommendation.aiExplanation,
  }));

  const totalMonthlyRecovery = opportunities.reduce((s, o) => s + o.estimatedMonthlyImpact, 0);
  const topOpp = opportunities[0] ?? null;

  const actionable = products.filter(
    (p) => p.recommendation.badge !== "healthy" && p.recommendation.badge !== "monitor",
  );

  return {
    executiveSummary: {
      totalProducts: products.length,
      activeProducts,
      profitable,
      losingMoney,
      outOfStock,
      deadInventory,
      highestProfitProduct: highest
        ? { title: highest.title, netProfit: highest.netProfit }
        : null,
      biggestOpportunity: topOpp
        ? {
            title: topOpp.title,
            productTitle: topOpp.productTitle,
            estimatedMonthlyImpact: topOpp.estimatedMonthlyImpact,
          }
        : null,
    },
    recovery: { totalMonthlyRecovery, opportunities },
    products,
    allHealthy: actionable.length === 0,
  };
}

export type { ProductLifecycleStage, ProductHealthFactor };
