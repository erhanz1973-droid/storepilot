import type { Recommendation } from "@/lib/types";
import type { StoreSnapshot } from "@/lib/connectors/types";
import {
  formatUsd,
  ga4Sessions,
  googleAdsLinked,
  metaAdsLinked,
  orderCount,
  productQualityCounts,
  revenueAmount,
} from "./snapshot-facts";
import { SHORT_DESCRIPTION_CHARS } from "./thresholds";
import type {
  GrowthChecklistStep,
  KnownFact,
  MerchantMaturity,
  NextBestAction,
} from "./types";

const PROFIT_ROAS_PATTERN = /\broas\b|profitability|blended|cac\b|budget allocation/i;

export type SelectNextBestActionInput = {
  snapshot: StoreSnapshot;
  maturity: MerchantMaturity;
  checklist: GrowthChecklistStep[];
  recommendations?: Recommendation[];
  basedOn: KnownFact[];
};

function facts(snapshot: StoreSnapshot): KnownFact[] {
  return [
    { label: "Products", value: String(snapshot.products.length) },
    { label: "Orders", value: String(orderCount(snapshot)) },
    { label: "Revenue", value: formatUsd(revenueAmount(snapshot)) },
  ];
}

function action(partial: Omit<NextBestAction, "basedOn" | "fromRecommendationEngine"> & {
  basedOn?: KnownFact[];
  fromRecommendationEngine?: boolean;
}): NextBestAction {
  return {
    basedOn: partial.basedOn ?? [],
    fromRecommendationEngine: partial.fromRecommendationEngine ?? false,
    ...partial,
  };
}

function fallback(snapshot: StoreSnapshot, basedOn: KnownFact[]): NextBestAction {
  const orders = orderCount(snapshot);
  const products = snapshot.products.length;
  if (products === 0) {
    return action({
      id: "add_products",
      stepId: "store_setup",
      severity: "critical",
      title: "Add your first products",
      problem: "The Shopify catalog is empty.",
      whyItMatters: "StorePilot cannot diagnose conversion or demand without products.",
      recommendedAction: "Add products in Shopify, then return so we can review titles, prices, and images.",
      ctaLabel: "Review products",
      ctaHref: "/analytics/products",
      basedOn,
    });
  }
  if (orders === 0) {
    return action({
      id: "first_sale",
      stepId: "first_sales",
      severity: "high",
      title: "Your first goal is your first sale",
      problem: "Shopify shows 0 orders so far.",
      whyItMatters: "Until a customer buys, StorePilot cannot measure what is working.",
      recommendedAction: "Make sure products are complete, then get visitors to the store.",
      ctaLabel: "Review products",
      ctaHref: "/analytics/products",
      basedOn,
    });
  }
  return action({
    id: "keep_going",
    stepId: "store_setup",
    severity: "low",
    title: "We don't have enough data yet for a stronger call",
    problem: "Connected data does not support an advanced recommendation right now.",
    whyItMatters: "Guessing ROAS, profit, or conversion rate would be dishonest.",
    recommendedAction: "Follow the growth checklist. New recommendations appear as more store data arrives.",
    ctaLabel: "Open growth checklist",
    ctaHref: "/grow",
    basedOn,
  });
}

function engineRecAsAction(rec: Recommendation, basedOn: KnownFact[]): NextBestAction {
  return action({
    id: `engine:${rec.id}`,
    stepId: "product_readiness",
    severity: rec.severity === "critical" || rec.severity === "high" ? rec.severity : "medium",
    title: rec.title,
    problem: rec.reason,
    whyItMatters: rec.reason,
    recommendedAction: rec.actionLabel || "Review this recommendation",
    ctaLabel: rec.actionLabel || "Review",
    ctaHref: `/recommendations/${rec.id}`,
    basedOn: rec.supportingMetrics?.slice(0, 4).map((m) => ({ label: m.label, value: m.value })) ?? basedOn,
    fromRecommendationEngine: true,
    recommendationId: rec.id,
  });
}

function isHonestEngineRec(rec: Recommendation, maturity: MerchantMaturity): boolean {
  if (maturity.stage !== "new") return true;
  const blob = `${rec.title} ${rec.reason} ${rec.expectedImpact}`;
  if (PROFIT_ROAS_PATTERN.test(blob)) return false;
  if (rec.category === "campaign_review" && !maturity.meaningfulAdsData) return false;
  if (rec.category === "slow_selling" && maturity.orders30d < 15) return false;
  return true;
}

export function selectNextBestAction(input: SelectNextBestActionInput): NextBestAction {
  const { snapshot, maturity, checklist } = input;
  const basedOn = input.basedOn.length > 0 ? input.basedOn : facts(snapshot);
  const quality = productQualityCounts(snapshot);
  const byId = Object.fromEntries(checklist.map((step) => [step.id, step]));

  if (quality.total === 0) {
    return fallback(snapshot, basedOn);
  }

  if (quality.missingTitle > 0 || quality.missingPrice > 0) {
    return action({
      id: "fix_product_basics",
      stepId: "store_setup",
      severity: "critical",
      title:
        quality.missingPrice > 0
          ? `Set prices on ${quality.missingPrice} product${quality.missingPrice === 1 ? "" : "s"}`
          : `Fix ${quality.missingTitle} product title${quality.missingTitle === 1 ? "" : "s"}`,
      problem:
        quality.missingPrice > 0
          ? `${quality.missingPrice} of ${quality.total} products have a missing or $0 price.`
          : `${quality.missingTitle} of ${quality.total} products have a missing or placeholder title.`,
      whyItMatters: "Customers cannot buy a product they cannot identify or price.",
      recommendedAction: "Open those products in Shopify and complete the missing fields.",
      ctaLabel: "Review products",
      ctaHref: "/analytics/products",
      basedOn,
    });
  }

  if (quality.descriptionsKnown) {
    const incomplete = quality.missingDescription + quality.shortDescription;
    if (incomplete > 0) {
      return action({
        id: "improve_descriptions",
        stepId: "product_readiness",
        severity: "high",
        title: `Improve ${incomplete} product description${incomplete === 1 ? "" : "s"}`,
        problem: `${incomplete} of your products have incomplete or very short descriptions (under ${SHORT_DESCRIPTION_CHARS} characters).`,
        whyItMatters: "Customers may not have enough information to decide whether to buy.",
        recommendedAction: `Improve the descriptions of these ${incomplete} products.`,
        ctaLabel: "Review products",
        ctaHref: "/analytics/products",
        basedOn,
      });
    }
  }

  if (quality.missingImage > 0) {
    return action({
      id: "add_images",
      stepId: "product_readiness",
      severity: "high",
      title: `Add images to ${quality.missingImage} product${quality.missingImage === 1 ? "" : "s"}`,
      problem: `${quality.missingImage} of ${quality.total} products have no featured image.`,
      whyItMatters: "Products without photos rarely convert, even with traffic.",
      recommendedAction: "Add at least one image to each product that is missing one.",
      ctaLabel: "Review products",
      ctaHref: "/analytics/products",
      basedOn,
    });
  }

  const conversion = byId.conversion_readiness;
  const policyMissing = conversion?.items.find((i) => i.id === "trust" && i.status === "missing");
  if (policyMissing) {
    return action({
      id: "add_policies",
      stepId: "conversion_readiness",
      severity: "high",
      title: "Publish store policies",
      problem: policyMissing.detail,
      whyItMatters: "Refund and shipping policies are basic trust signals on a new store.",
      recommendedAction: "Add refund, privacy, shipping, and terms pages in Shopify settings.",
      ctaLabel: "Open connections",
      ctaHref: "/connections",
      basedOn,
    });
  }

  if (!metaAdsLinked(snapshot)) {
    return action({
      id: "connect_meta",
      stepId: "marketing_setup",
      severity: "high",
      title: "Connect Meta Ads",
      problem: "StorePilot can't measure your advertising performance yet.",
      whyItMatters:
        "Connecting Meta Ads will unlock ROAS, advertising spend, campaign performance, and profitability insights — once campaigns have data.",
      recommendedAction: "Connect Meta Ads so StorePilot can observe spend and results.",
      ctaLabel: "Connect Meta Ads",
      ctaHref: "/connections?tab=advertising&highlight=meta_ads",
      basedOn,
    });
  }

  if (!googleAdsLinked(snapshot) && maturity.stage !== "new") {
    return action({
      id: "connect_google",
      stepId: "marketing_setup",
      severity: "medium",
      title: "Connect Google Ads",
      problem: "Google Ads isn't connected.",
      whyItMatters: "Without Google Ads, channel comparison and blended ROAS are incomplete.",
      recommendedAction: "Connect Google Ads to measure search and shopping performance.",
      ctaLabel: "Connect Google Ads",
      ctaHref: "/connections?tab=advertising&highlight=google_ads",
      basedOn,
    });
  }

  const sessions = ga4Sessions(snapshot);
  const orders = orderCount(snapshot);
  const setupReady = byId.store_setup?.complete && byId.product_readiness?.complete;

  if (setupReady && orders === 0 && (sessions == null || sessions === 0)) {
    return action({
      id: "get_traffic",
      stepId: "first_traffic",
      severity: "high",
      title: "Your store is ready. Now let's get visitors.",
      problem:
        sessions === 0
          ? "GA4 shows 0 sessions in the last 30 days."
          : "There is no measured traffic yet, and Shopify shows 0 orders.",
      whyItMatters: "A complete catalog does not create sales until people arrive.",
      recommendedAction: metaAdsLinked(snapshot)
        ? "Plan your first campaign now that the store basics look ready."
        : "Connect Meta Ads or send people to the store so the first visits can happen.",
      ctaLabel: metaAdsLinked(snapshot) ? "Plan your first campaign" : "Connect Meta Ads",
      ctaHref: metaAdsLinked(snapshot)
        ? "/advertising"
        : "/connections?tab=advertising&highlight=meta_ads",
      basedOn,
    });
  }

  if (orders === 0) {
    return action({
      id: "first_sale",
      stepId: "first_sales",
      severity: "high",
      title: "Your first goal is your first sale",
      problem: "Shopify shows 0 orders.",
      whyItMatters: "StorePilot cannot produce profitability or ROAS advice without sales.",
      recommendedAction: "Keep the catalog tight, get visitors, and come back after the first order.",
      ctaLabel: "Review products",
      ctaHref: "/analytics/products",
      basedOn,
    });
  }

  const honest = (input.recommendations ?? []).filter((rec) => isHonestEngineRec(rec, maturity));
  if (honest[0] && maturity.stage !== "new") {
    return engineRecAsAction(honest[0], basedOn);
  }

  if (!googleAdsLinked(snapshot)) {
    return action({
      id: "connect_google_new",
      stepId: "marketing_setup",
      severity: "medium",
      title: "Connect Google Ads",
      problem: "Google Ads isn't connected.",
      whyItMatters: "A second acquisition channel helps StorePilot compare where sales come from.",
      recommendedAction: "Connect Google Ads when you are ready to measure search demand.",
      ctaLabel: "Connect Google Ads",
      ctaHref: "/connections?tab=advertising&highlight=google_ads",
      basedOn,
    });
  }

  return fallback(snapshot, basedOn);
}

export function filterHonestEngineRecommendations(
  recommendations: Recommendation[],
  maturity: MerchantMaturity,
): Recommendation[] {
  return recommendations.filter((rec) => isHonestEngineRec(rec, maturity));
}
