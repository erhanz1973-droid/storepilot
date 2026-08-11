import type { StoreSnapshot } from "@/lib/connectors/types";
import { hasActiveAdsConnector } from "@/lib/connectors/active";
import type { AnalyzerOutput, Recommendation } from "@/lib/types";

/** Stable analyzer/dedupe id — refresh must upsert, not duplicate. */
export const FIRST_VALUE_DEDUPE_KEY = "first-value-best-seller";

export type FirstValueKnownFact = {
  label: string;
  value: string;
};

export type FirstValuePrimaryAction = {
  label: string;
  href: string;
};

export type FirstValueKind = "recommendation" | "low_data";

export type FirstValueInsight = {
  kind: FirstValueKind;
  headline: string;
  body: string;
  known: FirstValueKnownFact[];
  unknown: FirstValueKnownFact[];
  nextActions: FirstValuePrimaryAction[];
  primaryAction: FirstValuePrimaryAction;
  whyThisMatters: string;
  whatToDoNext: string;
  recommendationType: "best_seller_focus" | "early_sales_signal" | "low_data_catalog";
  /** Present only when we have evidence-backed catalog/sales advice. */
  output: AnalyzerOutput | null;
};

export function formatUsd(amount: number): string {
  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

export function catalogFacts(snapshot: StoreSnapshot): {
  products: number;
  orders: number;
  revenue: number;
  adsConnected: boolean;
} {
  const products = snapshot.products.length;
  const orders =
    snapshot.commerceOrders?.length ?? snapshot.storeMetrics.orders30d ?? 0;
  const revenueFromOrders = (snapshot.commerceOrders ?? []).reduce(
    (sum, order) => sum + (order.revenue ?? 0),
    0,
  );
  const revenue =
    revenueFromOrders > 0 ? revenueFromOrders : snapshot.storeMetrics.revenue30d ?? 0;
  return {
    products,
    orders,
    revenue,
    adsConnected: hasActiveAdsConnector(snapshot.connectorStates ?? {}),
  };
}

function knownFacts(facts: ReturnType<typeof catalogFacts>): FirstValueKnownFact[] {
  return [
    { label: "Products", value: String(facts.products) },
    { label: "Orders", value: String(facts.orders) },
    { label: "Revenue", value: formatUsd(facts.revenue) },
  ];
}

function unknownFacts(facts: ReturnType<typeof catalogFacts>): FirstValueKnownFact[] {
  const unknown: FirstValueKnownFact[] = [];
  if (!facts.adsConnected) {
    unknown.push(
      { label: "Advertising profitability", value: "Not available yet" },
      { label: "Customer acquisition cost", value: "Not available yet" },
      { label: "Channel ROAS", value: "Not available yet" },
    );
  }
  if (facts.orders === 0) {
    unknown.push({ label: "Best-selling product", value: "No sales to rank yet" });
  }
  return unknown;
}

function connectAdsAction(): FirstValuePrimaryAction {
  return { label: "Connect Meta Ads", href: "/connections?tab=advertising" };
}

function reviewProductAction(recommendationId?: string): FirstValuePrimaryAction {
  if (recommendationId) {
    return { label: "Review product", href: `/recommendations/${recommendationId}` };
  }
  return { label: "Review products", href: "/products" };
}

type SellerSignal = {
  id: string;
  title: string;
  units: number;
  revenue: number;
};

function sellerFromProducts(snapshot: StoreSnapshot): SellerSignal | null {
  const ranked = [...snapshot.products]
    .map((product) => ({
      id: product.id,
      title: product.title,
      units: product.unitsSold30d ?? 0,
      revenue: product.revenue30d ?? 0,
    }))
    .filter((row) => row.units > 0 || row.revenue > 0)
    .sort((a, b) => {
      if (b.units !== a.units) return b.units - a.units;
      return b.revenue - a.revenue;
    });
  return ranked[0] ?? null;
}

function sellerFromOrders(snapshot: StoreSnapshot): SellerSignal | null {
  const byProduct = new Map<string, SellerSignal>();
  for (const order of snapshot.commerceOrders ?? []) {
    for (const line of order.lines ?? []) {
      const id = line.productId || line.title;
      if (!id) continue;
      const current = byProduct.get(id) ?? {
        id,
        title: line.title || id,
        units: 0,
        revenue: 0,
      };
      current.units += line.quantity ?? 0;
      current.revenue += line.revenue ?? 0;
      byProduct.set(id, current);
    }
  }
  return [...byProduct.values()]
    .filter((row) => row.units > 0 || row.revenue > 0)
    .sort((a, b) => {
      if (b.units !== a.units) return b.units - a.units;
      return b.revenue - a.revenue;
    })[0] ?? null;
}

export function pickBestSeller(snapshot: StoreSnapshot): SellerSignal | null {
  return sellerFromProducts(snapshot) ?? sellerFromOrders(snapshot);
}

function lowDataInsight(facts: ReturnType<typeof catalogFacts>): FirstValueInsight {
  const primary = facts.products === 0
    ? { label: "Complete product setup", href: "/products" }
    : connectAdsAction();
  const nextActions: FirstValuePrimaryAction[] = [
    connectAdsAction(),
    { label: "Connect Google Ads", href: "/connections?tab=advertising" },
    { label: "Complete your product setup", href: "/products" },
  ];

  return {
    kind: "low_data",
    headline: "Your store is connected",
    body: "We need more data to generate reliable performance recommendations.",
    known: knownFacts(facts),
    unknown: unknownFacts(facts),
    nextActions,
    primaryAction: primary,
    whyThisMatters:
      "StorePilot only recommends what your live Shopify data can support. With no sales yet, a profitability or ROAS recommendation would be a guess.",
    whatToDoNext:
      facts.products === 0
        ? "Add products in Shopify, then return so we can analyze your catalog."
        : "Connect Meta Ads to unlock advertising recommendations, or return after your first sales.",
    recommendationType: "low_data_catalog",
    output: null,
  };
}

function bestSellerOutput(seller: SellerSignal, facts: ReturnType<typeof catalogFacts>): AnalyzerOutput {
  const evidence = [
    { label: "Orders", value: String(facts.orders) },
    { label: `${seller.title} sales`, value: `${seller.units} unit${seller.units === 1 ? "" : "s"}` },
    { label: "Revenue", value: formatUsd(facts.revenue) },
  ];
  if (seller.revenue > 0 && seller.revenue !== facts.revenue) {
    evidence.push({ label: `${seller.title} revenue`, value: formatUsd(seller.revenue) });
  }

  return {
    id: FIRST_VALUE_DEDUPE_KEY,
    category: "homepage_merchandising",
    title: `Focus your next merchandising test on ${seller.title}`,
    description: `Among ${facts.orders} order${facts.orders === 1 ? "" : "s"} in the current window, ${seller.title} is the only clear sales signal (${seller.units} unit${seller.units === 1 ? "" : "s"}, ${formatUsd(seller.revenue || facts.revenue)}). That is not enough history for ROAS or profit advice — it is enough to focus the next test on the product customers already bought.`,
    priority: "medium",
    expectedImpact:
      "Use your only sales signal to focus the next merchandising or marketing test — no projected profit is claimed from this sample.",
    confidence: facts.orders >= 5 ? 0.64 : 0.56,
    evidence,
    actions: [{ label: "Review product", type: "review" }],
    entityType: "product",
    entityId: seller.id,
  };
}

function earlySalesOutput(facts: ReturnType<typeof catalogFacts>): AnalyzerOutput {
  return {
    id: FIRST_VALUE_DEDUPE_KEY,
    category: "homepage_merchandising",
    title: "Your store has early sales — keep collecting signal",
    description: `Shopify shows ${facts.orders} order${facts.orders === 1 ? "" : "s"} totaling ${formatUsd(facts.revenue)} across ${facts.products} products. Line-level product sales are not clear enough yet to name a bestseller, so StorePilot will not invent one.`,
    priority: "low",
    expectedImpact:
      "Protect decision quality by waiting for a repeatable product-level sales pattern before recommending what to scale.",
    confidence: 0.52,
    evidence: [
      { label: "Orders", value: String(facts.orders) },
      { label: "Products", value: String(facts.products) },
      { label: "Revenue", value: formatUsd(facts.revenue) },
    ],
    actions: [{ label: "Review products", type: "review" }],
  };
}

/**
 * Honest first-value insight from live Shopify catalog/sales data.
 * Never fabricates ROAS, profit, or a bestseller that the snapshot cannot support.
 */
export function buildFirstValueInsight(snapshot: StoreSnapshot): FirstValueInsight {
  const facts = catalogFacts(snapshot);

  if (facts.orders <= 0) {
    return lowDataInsight(facts);
  }

  const seller = pickBestSeller(snapshot);
  if (seller) {
    const output = bestSellerOutput(seller, facts);
    return {
      kind: "recommendation",
      headline: "Your first StorePilot insight",
      body: output.description,
      known: knownFacts(facts),
      unknown: unknownFacts(facts),
      nextActions: [reviewProductAction(), connectAdsAction()],
      primaryAction: reviewProductAction(),
      whyThisMatters:
        "Early stores waste spend testing products with no proof of demand. Your orders already point to one product.",
      whatToDoNext: facts.adsConnected
        ? `Review ${seller.title}, then keep this SKU in the next merchandising test.`
        : `Review ${seller.title}. Connect Meta Ads when you are ready for advertising recommendations.`,
      recommendationType: "best_seller_focus",
      output,
    };
  }

  const output = earlySalesOutput(facts);
  return {
    kind: "recommendation",
    headline: "Your first StorePilot insight",
    body: output.description,
    known: knownFacts(facts),
    unknown: unknownFacts(facts),
    nextActions: [reviewProductAction(), connectAdsAction()],
    primaryAction: reviewProductAction(),
    whyThisMatters:
      "You have real sales, but not a trustworthy product ranking yet. Naming a winner from missing line data would be a guess.",
    whatToDoNext: "Review the catalog, keep selling, and return after more orders land.",
    recommendationType: "early_sales_signal",
    output,
  };
}

export function isFirstValueRecommendation(rec: Pick<Recommendation, "id"> | AnalyzerOutput): boolean {
  return rec.id === FIRST_VALUE_DEDUPE_KEY || rec.id.startsWith("first-value-");
}

export function shouldSurfaceFirstValueOnDashboard(input: {
  insight: FirstValueInsight;
  hasExecutiveDecision: boolean;
  shopifyConnected?: boolean;
}): boolean {
  if (input.shopifyConnected === false) return false;
  if (input.hasExecutiveDecision) return false;
  if (input.insight.kind === "low_data") return true;
  const orders = Number(input.insight.known.find((row) => row.label === "Orders")?.value ?? 0);
  return orders < 10;
}
