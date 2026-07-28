/**
 * Data Availability Layer — StorePilot must never fabricate analysis
 * from disconnected systems. Recommendations declare required sources;
 * opportunities may be suggested without evidence but must be labeled.
 */

export type ExecutiveDataSourceId =
  | "shopify"
  | "meta_ads"
  | "google_ads"
  | "ga4"
  | "inventory"
  | "customers"
  | "orders"
  | "product_costs";

export type ExecutiveDataSourceState = {
  id: ExecutiveDataSourceId;
  label: string;
  connected: boolean;
};

export type RecommendationKind = "recommendation" | "opportunity" | "integration";

export type DataRequirementSpec = {
  /** Stable recommendation family id */
  id: string;
  kind: RecommendationKind;
  /** Human title pattern / family */
  label: string;
  requiredSources: ExecutiveDataSourceId[];
  /** Match titles / threat labels (case-insensitive) */
  matchPatterns: RegExp[];
};

export type BusinessCoverage = {
  /** 0–100 */
  scorePct: number;
  connected: ExecutiveDataSourceState[];
  missing: ExecutiveDataSourceState[];
  /** Short explanation for AI confidence */
  confidenceLimitation: string | null;
};

export type AdvertisingIntelligencePanel = {
  headline: string;
  body: string;
  bullets: string[];
  closing: string;
  ctaLabel: string;
  ctaHref: string;
};

export type ConnectedSourcesInput = {
  shopify?: boolean;
  metaAds?: boolean;
  googleAds?: boolean;
  ga4?: boolean;
  inventory?: boolean;
  customers?: boolean;
};

/** Families that require live advertising campaign data (Rule 1). */
export const ADVERTISING_DATA_REQUIREMENTS: DataRequirementSpec[] = [
  {
    id: "roas_optimization",
    kind: "recommendation",
    label: "ROAS optimization",
    requiredSources: ["meta_ads", "google_ads", "orders"],
    matchPatterns: [/\broas\b/i, /return on ad/i],
  },
  {
    id: "campaign_performance",
    kind: "recommendation",
    label: "Campaign performance",
    requiredSources: ["meta_ads", "google_ads"],
    matchPatterns: [/campaign performance/i, /winning campaigns?/i, /losing campaigns?/i],
  },
  {
    id: "budget_allocation",
    kind: "recommendation",
    label: "Budget allocation",
    requiredSources: ["meta_ads", "google_ads"],
    matchPatterns: [/budget (shift|allocation|increase|reduce)/i, /increase .+ ads? budget/i, /reduce .+ budget/i],
  },
  {
    id: "advertising_leakage",
    kind: "recommendation",
    label: "Advertising leakage",
    requiredSources: ["meta_ads", "google_ads"],
    matchPatterns: [/advertising leakage/i, /wasted ad spend/i, /ad waste/i],
  },
  {
    id: "creative_fatigue",
    kind: "recommendation",
    label: "Creative fatigue",
    requiredSources: ["meta_ads"],
    matchPatterns: [/creative fatigue/i, /ad fatigue/i],
  },
  {
    id: "cpc_optimization",
    kind: "recommendation",
    label: "CPC optimization",
    requiredSources: ["meta_ads", "google_ads"],
    matchPatterns: [/\bcpc\b/i, /cost per click/i],
  },
  {
    id: "cac_optimization",
    kind: "recommendation",
    label: "CAC optimization",
    requiredSources: ["meta_ads", "google_ads", "orders"],
    matchPatterns: [/\bcac\b/i, /customer acquisition cost/i],
  },
  {
    id: "audience_performance",
    kind: "recommendation",
    label: "Audience performance",
    requiredSources: ["meta_ads", "google_ads"],
    matchPatterns: [/audience performance/i, /prospecting audience/i],
  },
  {
    id: "marketing_attribution",
    kind: "recommendation",
    label: "Marketing attribution",
    requiredSources: ["meta_ads", "google_ads", "orders"],
    matchPatterns: [/marketing attribution/i, /attributed (revenue|sales)/i],
  },
];

/** Evidence-based recommendations that do not require ads. */
export const SHOPIFY_DATA_REQUIREMENTS: DataRequirementSpec[] = [
  {
    id: "dead_inventory",
    kind: "recommendation",
    label: "Dead inventory",
    requiredSources: ["shopify", "inventory"],
    matchPatterns: [/dead inventory/i, /slow[- ]moving/i, /clearance/i],
  },
  {
    id: "abandoned_carts",
    kind: "recommendation",
    label: "Abandoned carts",
    requiredSources: ["shopify", "customers"],
    matchPatterns: [/abandoned cart/i],
  },
  {
    id: "free_shipping_threshold",
    kind: "recommendation",
    label: "Free shipping threshold",
    requiredSources: ["shopify", "orders"],
    matchPatterns: [/free shipping/i],
  },
  {
    id: "product_bundles",
    kind: "recommendation",
    label: "Product bundles",
    requiredSources: ["shopify", "inventory"],
    matchPatterns: [/bundle products?/i, /create bundle/i],
  },
];

export const ALL_DATA_REQUIREMENTS: DataRequirementSpec[] = [
  ...ADVERTISING_DATA_REQUIREMENTS,
  ...SHOPIFY_DATA_REQUIREMENTS,
];

const SOURCE_LABELS: Record<ExecutiveDataSourceId, string> = {
  shopify: "Shopify",
  meta_ads: "Meta Ads",
  google_ads: "Google Ads",
  ga4: "GA4",
  inventory: "Inventory",
  customers: "Customers",
  orders: "Orders",
  product_costs: "Product Costs",
};

export function resolveSourceAvailability(
  sources: ConnectedSourcesInput,
): Record<ExecutiveDataSourceId, boolean> {
  const shopify = sources.shopify !== false;
  const meta = Boolean(sources.metaAds);
  const google = Boolean(sources.googleAds);
  return {
    shopify,
    meta_ads: meta,
    google_ads: google,
    ga4: Boolean(sources.ga4),
    inventory: sources.inventory !== false,
    customers: sources.customers !== false,
    orders: shopify,
    product_costs: shopify,
  };
}

export function adsCampaignDataAvailable(sources: ConnectedSourcesInput): boolean {
  return Boolean(sources.metaAds || sources.googleAds);
}

/**
 * At least one required advertising connector must be connected for
 * advertising-family recommendations (OR across meta/google when both listed).
 */
export function requiredSourcesSatisfied(
  required: ExecutiveDataSourceId[],
  availability: Record<ExecutiveDataSourceId, boolean>,
): boolean {
  const adReqs = required.filter((r) => r === "meta_ads" || r === "google_ads");
  const otherReqs = required.filter((r) => r !== "meta_ads" && r !== "google_ads");

  for (const id of otherReqs) {
    if (!availability[id]) return false;
  }

  if (adReqs.length > 0) {
    const anyAd = adReqs.some((id) => availability[id]);
    if (!anyAd) return false;
  }

  return true;
}

export function findRequirementForTitle(title: string): DataRequirementSpec | null {
  for (const spec of ALL_DATA_REQUIREMENTS) {
    if (spec.matchPatterns.some((re) => re.test(title))) return spec;
  }
  return null;
}

/** True when a title/claim requires ads data that is not connected. */
export function requiresUnavailableAdvertisingData(
  title: string,
  sources: ConnectedSourcesInput,
): boolean {
  if (adsCampaignDataAvailable(sources)) return false;
  const spec = findRequirementForTitle(title);
  if (!spec) {
    // Broad catch for ad language when no ads connected
    return /\b(roas|cpc|cpa|cac|campaign|ad spend|advertising|meta ads|google ads|creative fatigue|audience)\b/i.test(
      title,
    );
  }
  return spec.requiredSources.some((s) => s === "meta_ads" || s === "google_ads");
}

export function canEmitAsRecommendation(
  title: string,
  sources: ConnectedSourcesInput,
): boolean {
  return !requiresUnavailableAdvertisingData(title, sources);
}

export function buildBusinessCoverage(sources: ConnectedSourcesInput): BusinessCoverage {
  const availability = resolveSourceAvailability(sources);
  const tracked: ExecutiveDataSourceId[] = [
    "shopify",
    "inventory",
    "customers",
    "meta_ads",
    "google_ads",
    "ga4",
  ];

  const states: ExecutiveDataSourceState[] = tracked.map((id) => ({
    id,
    label: SOURCE_LABELS[id],
    connected: availability[id],
  }));

  const connected = states.filter((s) => s.connected);
  const missing = states.filter((s) => !s.connected);
  const scorePct = Math.round((connected.length / tracked.length) * 100);

  let confidenceLimitation: string | null = null;
  if (missing.some((m) => m.id === "meta_ads" || m.id === "google_ads" || m.id === "ga4")) {
    const missingAds = missing
      .filter((m) => m.id === "meta_ads" || m.id === "google_ads" || m.id === "ga4")
      .map((m) => m.label);
    confidenceLimitation = `Limited by missing ${missingAds.join(" and ")} data.`;
  }

  return { scorePct, connected, missing, confidenceLimitation };
}

/** Reduce displayed confidence when coverage is incomplete. */
export function applyCoverageConfidencePenalty(
  baseConfidencePct: number,
  coverage: BusinessCoverage,
): { confidencePct: number; limitation: string | null } {
  const missingWeight = coverage.missing.length;
  // ~6 pts per missing core source, capped so we don't collapse to zero.
  const penalty = Math.min(28, missingWeight * 6);
  const confidencePct = Math.max(35, Math.round(baseConfidencePct - penalty));
  return {
    confidencePct,
    limitation: coverage.confidenceLimitation,
  };
}

export function buildAdvertisingIntelligencePanel(): AdvertisingIntelligencePanel {
  return {
    headline: "Advertising Intelligence",
    body: "Advertising platforms are not connected.\n\nI cannot evaluate campaign performance or advertising profitability.",
    bullets: [
      "identify wasted ad spend",
      "calculate blended ROAS",
      "recommend budget shifts",
      "detect winning campaigns",
      "measure true marketing profitability",
    ],
    closing:
      "If you are already running advertising, connect Meta Ads and/or Google Ads. If you are not yet running advertising, your Shopify data may still surface merchandising and inventory opportunities before paid acquisition.",
    ctaLabel: "Connect Advertising Platforms",
    ctaHref: "/connections?highlight=meta_ads",
  };
}

/** Soft opportunities — never presented as evidence-based recommendations. */
export const ADVERTISING_OPPORTUNITIES_WITHOUT_DATA: Array<{
  id: string;
  title: string;
  detail: string;
}> = [
  {
    id: "opp-test-google",
    title: "Consider testing Google Ads after inventory optimization",
    detail: "Opportunity — not based on live campaign data.",
  },
  {
    id: "opp-meta-prospecting",
    title: "Consider Meta prospecting campaigns once bestsellers are in stock",
    detail: "Opportunity — not based on live campaign data.",
  },
];

export function filterPlaybookTitlesForDataAvailability<T extends { title: string; module?: string }>(
  items: T[],
  sources: ConnectedSourcesInput,
): T[] {
  return items.filter((item) => {
    if (item.module === "connections") return true;
    return canEmitAsRecommendation(item.title, sources);
  });
}
