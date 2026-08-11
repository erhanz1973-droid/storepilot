import type { StoreSnapshot } from "@/lib/connectors/types";
import type { ProfitDashboard } from "@/lib/profit/types";
import {
  ga4Linked,
  ga4Sessions,
  googleAdsLinked,
  metaAdsLinked,
  orderCount,
  policyFlags,
  productQualityCounts,
  revenueAmount,
} from "./snapshot-facts";
import { PROFITABILITY_MIN_ORDERS, SHORT_DESCRIPTION_CHARS } from "./thresholds";
import type {
  CheckStatus,
  GrowthCheckItem,
  GrowthChecklistStep,
  MerchantMaturity,
} from "./types";

export type BuildChecklistInput = {
  snapshot: StoreSnapshot;
  maturity: MerchantMaturity;
  profitDashboard?: ProfitDashboard | null;
  hasProductCosts?: boolean;
};

function worstStatus(statuses: CheckStatus[]): CheckStatus {
  if (statuses.includes("missing")) return "missing";
  if (statuses.includes("needs_attention")) return "needs_attention";
  if (statuses.every((s) => s === "unknown" || s === "locked")) {
    return statuses.includes("locked") ? "locked" : "unknown";
  }
  const known = statuses.filter((s) => s !== "unknown" && s !== "locked");
  if (known.length === 0) return "unknown";
  if (known.every((s) => s === "ready")) return "ready";
  return "needs_attention";
}

function item(
  id: string,
  label: string,
  status: CheckStatus,
  detail: string,
  evidence?: string,
): GrowthCheckItem {
  return { id, label, status, detail, evidence };
}

function storeSetup(snapshot: StoreSnapshot): GrowthChecklistStep {
  const quality = productQualityCounts(snapshot);
  const policies = policyFlags(snapshot);
  const items: GrowthCheckItem[] = [];

  if (quality.total === 0) {
    items.push(
      item("products", "Products", "missing", "No products in the Shopify catalog yet."),
    );
  } else {
    items.push(
      item(
        "products",
        "Products",
        "ready",
        `${quality.total} product${quality.total === 1 ? "" : "s"} in the catalog.`,
        `${quality.total} products`,
      ),
    );
  }

  if (quality.total === 0) {
    items.push(item("titles", "Product titles", "missing", "Add products before titles can be checked."));
    items.push(item("prices", "Prices", "missing", "Add products before prices can be checked."));
    items.push(item("images", "Images", "missing", "Add products before images can be checked."));
    items.push(item("inventory", "Inventory", "missing", "Add products before inventory can be checked."));
  } else {
    items.push(
      quality.missingTitle > 0
        ? item(
            "titles",
            "Product titles",
            "needs_attention",
            `${quality.missingTitle} product${quality.missingTitle === 1 ? " has" : "s have"} a missing or placeholder title.`,
            `${quality.missingTitle} of ${quality.total}`,
          )
        : item("titles", "Product titles", "ready", "Titles look complete.", `${quality.total} titled`),
    );
    items.push(
      quality.missingPrice > 0
        ? item(
            "prices",
            "Prices",
            "needs_attention",
            `${quality.missingPrice} product${quality.missingPrice === 1 ? " has" : "s have"} a missing or $0 price.`,
            `${quality.missingPrice} of ${quality.total}`,
          )
        : item("prices", "Prices", "ready", "Every product has a price.", `${quality.total} priced`),
    );
    items.push(
      quality.missingImage > 0
        ? item(
            "images",
            "Images",
            quality.missingImage === quality.total ? "missing" : "needs_attention",
            `${quality.missingImage} product${quality.missingImage === 1 ? " has" : "s have"} no featured image.`,
            `${quality.missingImage} of ${quality.total}`,
          )
        : item("images", "Images", "ready", "Every product has a featured image.", `${quality.total} with images`),
    );
    items.push(
      quality.zeroInventoryTracked > 0
        ? item(
            "inventory",
            "Inventory",
            "needs_attention",
            `${quality.zeroInventoryTracked} tracked product${quality.zeroInventoryTracked === 1 ? " is" : "s are"} at 0 inventory.`,
            `${quality.zeroInventoryTracked} of ${quality.total}`,
          )
        : item("inventory", "Inventory", "ready", "Tracked products have inventory on hand."),
    );
  }

  if (quality.descriptionsKnown) {
    const incomplete = quality.missingDescription + quality.shortDescription;
    items.push(
      incomplete > 0
        ? item(
            "descriptions",
            "Descriptions",
            quality.missingDescription === quality.total ? "missing" : "needs_attention",
            `${incomplete} product${incomplete === 1 ? " needs" : "s need"} a fuller description.`,
          )
        : item("descriptions", "Descriptions", "ready", "Product descriptions look complete."),
    );
  } else {
    items.push(
      item(
        "descriptions",
        "Descriptions",
        "unknown",
        "Description text is not in this sync yet. We will not assume they are missing.",
      ),
    );
  }

  if (policies) {
    items.push(
      policies.shipping
        ? item("shipping", "Shipping policy", "ready", "A shipping policy page is published.")
        : item(
            "shipping",
            "Shipping policy",
            "missing",
            "No shipping policy page was found on the shop.",
          ),
    );
    items.push(
      policies.missingCount === 0
        ? item("policies", "Store policies", "ready", "Refund, privacy, shipping, and terms pages are present.")
        : item(
            "policies",
            "Store policies",
            "missing",
            `${policies.missingCount} legal page${policies.missingCount === 1 ? " is" : "s are"} missing (refund, privacy, shipping, or terms).`,
          ),
    );
  } else {
    items.push(
      item(
        "shipping",
        "Shipping policy",
        "unknown",
        "Shipping policy was not included in this Shopify sync. We will not guess.",
      ),
    );
    items.push(
      item(
        "policies",
        "Store policies",
        "unknown",
        "Policy pages were not included in this Shopify sync. We will not guess.",
      ),
    );
  }

  const status = worstStatus(items.map((i) => i.status));
  const complete = status === "ready";
  return {
    id: "store_setup",
    title: "Store Setup",
    status,
    summary:
      quality.total === 0
        ? "Add products in Shopify so StorePilot can analyze your catalog."
        : complete
          ? "Basic catalog setup looks complete."
          : "A few catalog fields still need attention.",
    items,
    ctaLabel: "Review products",
    ctaHref: "/analytics/products",
    complete,
  };
}

function productReadiness(snapshot: StoreSnapshot): GrowthChecklistStep {
  const quality = productQualityCounts(snapshot);
  const items: GrowthCheckItem[] = [];

  if (quality.total === 0) {
    return {
      id: "product_readiness",
      title: "Product Readiness",
      status: "missing",
      summary: "No products to review yet.",
      items: [item("catalog", "Catalog", "missing", "Add products in Shopify first.")],
      ctaLabel: "Review products",
      ctaHref: "/analytics/products",
      complete: false,
    };
  }

  if (quality.descriptionsKnown) {
    const incomplete = quality.missingDescription + quality.shortDescription;
    items.push(
      incomplete > 0
        ? item(
            "descriptions",
            "Descriptions",
            "needs_attention",
            `${incomplete} product${incomplete === 1 ? " has" : "s have"} a missing or very short description (under ${SHORT_DESCRIPTION_CHARS} characters).`,
            `${incomplete} of ${quality.total}`,
          )
        : item("descriptions", "Descriptions", "ready", "Descriptions meet the length check."),
    );
  } else {
    items.push(
      item(
        "descriptions",
        "Descriptions",
        "unknown",
        "We do not have description text in the current snapshot.",
      ),
    );
  }

  items.push(
    quality.missingImage > 0
      ? item(
          "images",
          "Images",
          "needs_attention",
          `${quality.missingImage} product${quality.missingImage === 1 ? " has" : "s have"} no featured image.`,
          `${quality.missingImage} of ${quality.total}`,
        )
      : item("images", "Images", "ready", "Featured images are present."),
  );
  items.push(
    quality.missingPrice > 0
      ? item(
          "prices",
          "Prices",
          "needs_attention",
          `${quality.missingPrice} product${quality.missingPrice === 1 ? " is" : "s are"} missing a price.`,
        )
      : item("prices", "Prices", "ready", "Prices are set."),
  );
  items.push(
    quality.missingTitle > 0
      ? item(
          "titles",
          "Titles",
          "needs_attention",
          `${quality.missingTitle} product${quality.missingTitle === 1 ? " needs" : "s need"} a real title.`,
        )
      : item("titles", "Titles", "ready", "Titles look usable."),
  );

  const status = worstStatus(items.map((i) => i.status));
  const incompleteDesc = quality.descriptionsKnown
    ? quality.missingDescription + quality.shortDescription
    : 0;
  const summary =
    incompleteDesc > 0
      ? `${incompleteDesc} product${incompleteDesc === 1 ? " needs" : "s need"} a better description.`
      : quality.missingImage > 0
        ? `${quality.missingImage} product${quality.missingImage === 1 ? " needs" : "s need"} a featured image.`
        : status === "ready"
          ? "Products look ready to sell."
          : "Some product fields still need attention.";

  return {
    id: "product_readiness",
    title: "Product Readiness",
    status,
    summary,
    items,
    ctaLabel: "Review products",
    ctaHref: "/analytics/products",
    complete: status === "ready",
  };
}

function conversionReadiness(snapshot: StoreSnapshot): GrowthChecklistStep {
  const quality = productQualityCounts(snapshot);
  const policies = policyFlags(snapshot);
  const items: GrowthCheckItem[] = [];

  if (quality.descriptionsKnown) {
    const incomplete = quality.missingDescription + quality.shortDescription;
    items.push(
      incomplete > 0
        ? item("copy", "Product copy", "needs_attention", "Thin descriptions make it harder for customers to decide.")
        : item("copy", "Product copy", "ready", "Descriptions give customers something to read."),
    );
  } else {
    items.push(
      item("copy", "Product copy", "unknown", "Description text is not in this sync."),
    );
  }

  items.push(
    quality.total > 0 && quality.missingImage === 0
      ? item("images", "Product images", "ready", "Products have featured images.")
      : item(
          "images",
          "Product images",
          quality.total === 0 ? "missing" : "needs_attention",
          quality.total === 0 ? "No products to convert yet." : "Some products are missing images.",
        ),
  );
  items.push(
    quality.total > 0 && quality.missingPrice === 0
      ? item("pricing", "Pricing", "ready", "Prices are set.")
      : item("pricing", "Pricing", "needs_attention", "Some products are missing prices."),
  );

  if (policies) {
    items.push(
      policies.missingCount === 0
        ? item("trust", "Trust signals", "ready", "Refund, privacy, shipping, and terms pages are published.")
        : item(
            "trust",
            "Trust signals",
            "missing",
            "Missing policy pages are a common reason new visitors do not buy.",
          ),
    );
  } else {
    items.push(
      item(
        "trust",
        "Trust signals",
        "unknown",
        "Policy pages were not included in this Shopify sync.",
      ),
    );
  }

  const status = worstStatus(items.map((i) => i.status));
  return {
    id: "conversion_readiness",
    title: "Store Conversion",
    status,
    summary:
      status === "ready"
        ? "Basic conversion ingredients look present."
        : "We only flag conversion gaps we can see in Shopify data.",
    items,
    ctaLabel: "Review products",
    ctaHref: "/analytics/products",
    complete: status === "ready",
  };
}

function marketingSetup(snapshot: StoreSnapshot): GrowthChecklistStep {
  const items: GrowthCheckItem[] = [
    metaAdsLinked(snapshot)
      ? item("meta", "Meta Ads", "ready", "Meta Ads is connected.")
      : item(
          "meta",
          "Meta Ads",
          "missing",
          "Meta Ads isn't connected. StorePilot can't measure advertising performance yet.",
        ),
    googleAdsLinked(snapshot)
      ? item("google", "Google Ads", "ready", "Google Ads is connected.")
      : item("google", "Google Ads", "missing", "Google Ads isn't connected."),
    ga4Linked(snapshot)
      ? item("ga4", "GA4", "ready", "GA4 is connected.")
      : item("ga4", "GA4", "missing", "GA4 isn't connected, so visitor traffic is not measured yet."),
  ];
  const status = worstStatus(items.map((i) => i.status));
  const missing = items.filter((i) => i.status === "missing");
  return {
    id: "marketing_setup",
    title: "Marketing Setup",
    status,
    summary:
      missing.length === 0
        ? "Advertising and analytics accounts are connected."
        : missing.map((i) => i.label).join(", ") + " not connected.",
    items,
    ctaLabel: missing[0]
      ? `Connect ${missing[0].label}`
      : "Review connections",
    ctaHref: missing[0]?.id === "ga4"
      ? "/connections?tab=analytics&highlight=ga4"
      : missing[0]?.id === "google"
        ? "/connections?tab=advertising&highlight=google_ads"
        : "/connections?tab=advertising&highlight=meta_ads",
    complete: status === "ready",
  };
}

function firstTraffic(snapshot: StoreSnapshot): GrowthChecklistStep {
  const sessions = ga4Sessions(snapshot);
  const orders = orderCount(snapshot);
  const items: GrowthCheckItem[] = [];

  if (sessions != null) {
    items.push(
      sessions > 0
        ? item("sessions", "Visitors", "ready", `GA4 recorded ${sessions.toLocaleString()} sessions in 30 days.`, `${sessions} sessions`)
        : item("sessions", "Visitors", "missing", "GA4 is connected and shows 0 sessions in 30 days."),
    );
  } else {
    items.push(
      item(
        "sessions",
        "Visitors",
        "unknown",
        "GA4 isn't connected, so we will not assume traffic is zero.",
      ),
    );
  }

  if (orders > 0) {
    items.push(
      item(
        "sales_imply_traffic",
        "Sales signal",
        "ready",
        `${orders} order${orders === 1 ? "" : "s"} prove that at least some visitors reached checkout.`,
      ),
    );
  }

  const complete = orders > 0 || (sessions != null && sessions > 0);
  const status: CheckStatus = complete ? "ready" : sessions === 0 ? "missing" : "needs_attention";
  return {
    id: "first_traffic",
    title: "Get Your First Traffic",
    status,
    summary: complete
      ? "There is evidence that visitors have reached the store."
      : "Your store needs visitors before sales and advertising insights can unlock.",
    items,
    ctaLabel: metaAdsLinked(snapshot) ? "Review advertising" : "Connect Meta Ads",
    ctaHref: metaAdsLinked(snapshot) ? "/advertising" : "/connections?tab=advertising&highlight=meta_ads",
    complete,
  };
}

function firstSales(snapshot: StoreSnapshot): GrowthChecklistStep {
  const orders = orderCount(snapshot);
  const revenue = revenueAmount(snapshot);
  const complete = orders > 0;
  return {
    id: "first_sales",
    title: "First Sales",
    status: complete ? "ready" : "missing",
    summary: complete
      ? `${orders} order${orders === 1 ? "" : "s"} totaling ${revenue.toLocaleString("en-US", { style: "currency", currency: "USD" })}.`
      : "Your first goal is your first sale.",
    items: [
      complete
        ? item("orders", "Orders", "ready", `${orders} order${orders === 1 ? "" : "s"} in the current window.`)
        : item("orders", "Orders", "missing", "Shopify shows 0 orders so far."),
    ],
    ctaLabel: complete ? "View sales" : "Review products",
    ctaHref: complete ? "/analytics/sales" : "/analytics/products",
    complete,
  };
}

function profitability(
  snapshot: StoreSnapshot,
  hasProductCosts?: boolean,
): GrowthChecklistStep {
  const orders = orderCount(snapshot);
  const unlocked =
    orders >= PROFITABILITY_MIN_ORDERS &&
    (Boolean(hasProductCosts) || snapshot.products.some((p) => (p.unitCost ?? 0) > 0));

  if (!unlocked) {
    return {
      id: "profitability",
      title: "Profitability",
      status: "locked",
      summary: "Profitability insights will unlock as your store generates more data.",
      items: [
        item(
          "profit",
          "Profit data",
          "locked",
          orders < PROFITABILITY_MIN_ORDERS
            ? `Need at least ${PROFITABILITY_MIN_ORDERS} orders before profit advice is meaningful (${orders} so far).`
            : "Product costs are not set, so we will not invent a margin or ROAS.",
        ),
      ],
      complete: false,
    };
  }

  return {
    id: "profitability",
    title: "Profitability",
    status: "ready",
    summary: "Enough order and cost data to review profit.",
    items: [item("profit", "Profit data", "ready", "Cost and order data are present.")],
    ctaLabel: "Open profitability",
    ctaHref: "/analytics/profit",
    complete: true,
  };
}

export function buildGrowthChecklist(input: BuildChecklistInput): GrowthChecklistStep[] {
  return [
    storeSetup(input.snapshot),
    productReadiness(input.snapshot),
    conversionReadiness(input.snapshot),
    marketingSetup(input.snapshot),
    firstTraffic(input.snapshot),
    firstSales(input.snapshot),
    profitability(input.snapshot, input.hasProductCosts),
  ];
}
