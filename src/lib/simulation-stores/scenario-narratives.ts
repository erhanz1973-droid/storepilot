import type { SimulationScenarioId } from "@/lib/simulation-lab/types";
import type { BusinessModel } from "@/lib/business-model/types";

export type SimulationScenarioNarrative = {
  scenarioId: SimulationScenarioId;
  title: string;
  paragraphs: string[];
  purpose: string;
  aiShouldRecommend: string;
};

const NARRATIVES: Record<SimulationScenarioId, SimulationScenarioNarrative> = {
  roas_collapse: {
    scenarioId: "roas_collapse",
    title: "Advertising Disaster",
    paragraphs: [
      "This is a simulated dropshipping store.",
      "The merchant increased Meta advertising spend by 300% over the last 14 days without improving creatives.",
      "ROAS has collapsed. Profitability is negative.",
    ],
    purpose: "Test how StorePilot detects ad waste and recommends pausing or optimizing campaigns.",
    aiShouldRecommend: "Pause or reduce underperforming campaigns and fix creative or targeting before scaling again.",
  },
  dead_inventory: {
    scenarioId: "dead_inventory",
    title: "Dead Inventory",
    paragraphs: [
      "This is a simulated inventory-led store.",
      "The merchant owns too much slow-moving inventory. Sales have decreased and cash flow is under pressure.",
      "Capital is tied up in SKUs that are barely moving.",
    ],
    purpose: "Test inventory clearance, bundling, and pricing recommendations.",
    aiShouldRecommend: "Inventory clearance, discounts, bundles, and merchandising changes to free cash.",
  },
  scaling_opportunity: {
    scenarioId: "scaling_opportunity",
    title: "Scaling Opportunity",
    paragraphs: [
      "This is a simulated growth-stage store.",
      "The business has healthy margins, strong ROAS, and inventory available to fulfill more orders.",
      "Paid campaigns are profitable but may be budget-capped.",
    ],
    purpose: "Test whether StorePilot recommends scaling winners instead of only flagging problems.",
    aiShouldRecommend: "Increase budget on high-ROAS campaigns while monitoring efficiency.",
  },
  healthy_store: {
    scenarioId: "healthy_store",
    title: "Healthy Store",
    paragraphs: [
      "This is a simulated balanced ecommerce business.",
      "Revenue, margins, and advertising efficiency are within normal ranges.",
      "No single crisis dominates — the store is operating steadily.",
    ],
    purpose: "Baseline scenario — verify StorePilot does not over-alert on healthy metrics.",
    aiShouldRecommend: "Incremental optimizations only; no urgent intervention expected.",
  },
  winning_product: {
    scenarioId: "winning_product",
    title: "Winning Product",
    paragraphs: [
      "This is a simulated dropshipping store with one hero SKU.",
      "A single product drives most revenue with strong ROAS and velocity.",
      "Supporting products contribute modestly.",
    ],
    purpose: "Test hero-product scaling and catalog concentration risk.",
    aiShouldRecommend: "Scale the winner and protect margin on supporting SKUs.",
  },
  creative_fatigue: {
    scenarioId: "creative_fatigue",
    title: "Creative Fatigue",
    paragraphs: [
      "This is a simulated paid-social store.",
      "Ad spend remains high but CTR is declining — audiences have seen the same creative too often.",
      "ROAS is slipping despite sustained budget.",
    ],
    purpose: "Test creative refresh and frequency recommendations.",
    aiShouldRecommend: "Rotate creative, refresh hooks, and cap frequency before cutting budget.",
  },
  inventory_overstock: {
    scenarioId: "inventory_overstock",
    title: "Inventory Overstock",
    paragraphs: [
      "This is a simulated general merchandise store.",
      "Several SKUs are overstocked relative to recent sales velocity.",
      "Warehouse capital is concentrated in slow movers.",
    ],
    purpose: "Test overstock detection and clearance prioritization.",
    aiShouldRecommend: "Targeted promotions and bundles on overstocked lines.",
  },
  low_conversion: {
    scenarioId: "low_conversion",
    title: "Low Conversion",
    paragraphs: [
      "This is a simulated digital products store.",
      "Traffic is arriving but checkout conversion is weak.",
      "Sessions are high relative to completed orders.",
    ],
    purpose: "Test funnel and merchandising recommendations.",
    aiShouldRecommend: "Landing page, offer, and checkout improvements — not more ad spend.",
  },
  high_cpc: {
    scenarioId: "high_cpc",
    title: "High CPC",
    paragraphs: [
      "This is a simulated paid acquisition store.",
      "Cost per click is elevated and margins are compressed.",
      "Revenue exists but efficiency is borderline.",
    ],
    purpose: "Test CPA and efficiency alerts.",
    aiShouldRecommend: "Tighten targeting, improve relevance scores, or shift budget to better channels.",
  },
  high_refund_rate: {
    scenarioId: "high_refund_rate",
    title: "High Refund Rate",
    paragraphs: [
      "This is a simulated physical-goods store.",
      "Refunds are eroding gross margin on otherwise healthy sales volume.",
      "Product quality or expectation mismatch may be driving returns.",
    ],
    purpose: "Test product and margin protection recommendations.",
    aiShouldRecommend: "Investigate product issues, adjust listings, and protect margin on affected SKUs.",
  },
  seasonal_demand: {
    scenarioId: "seasonal_demand",
    title: "Seasonal Demand",
    paragraphs: [
      "This is a simulated seasonal retail store.",
      "A seasonal spike is approaching and inventory is positioned for demand.",
      "The merchant needs to prepare campaigns and stock ahead of peak.",
    ],
    purpose: "Test seasonal merchandising and campaign timing.",
    aiShouldRecommend: "Prepare promotions, ensure stock coverage, and time ad spend to demand curves.",
  },
  price_too_high: {
    scenarioId: "price_too_high",
    title: "Price Too High",
    paragraphs: [
      "This is a simulated premium-positioned store.",
      "Products are priced above market tolerance — velocity is very low.",
      "Conversion suffers at the current price point.",
    ],
    purpose: "Test pricing and promotion recommendations.",
    aiShouldRecommend: "Price tests, limited promotions, or repositioning to restore velocity.",
  },
  price_too_low: {
    scenarioId: "price_too_low",
    title: "Price Too Low",
    paragraphs: [
      "This is a simulated high-velocity store.",
      "Demand is strong but prices are too low for sustainable margin.",
      "The business risks growing revenue without profit.",
    ],
    purpose: "Test margin and pricing uplift recommendations.",
    aiShouldRecommend: "Careful price increases on inelastic SKUs and margin guardrails.",
  },
  organic_growth: {
    scenarioId: "organic_growth",
    title: "Digital Products",
    paragraphs: [
      "This is a simulated digital catalog business.",
      "Organic and direct traffic drive most revenue with modest paid spend.",
      "Margins are high; acquisition is content-led.",
    ],
    purpose: "Test organic-led growth and merchandising recommendations.",
    aiShouldRecommend: "Homepage merchandising, bundles, and selective paid tests — not heavy scaling.",
  },
  launch_campaign: {
    scenarioId: "launch_campaign",
    title: "Print On Demand Launch",
    paragraphs: [
      "This is a simulated print-on-demand launch.",
      "A new product line shows early traction with launch campaigns active.",
      "Spend is moderate; the merchant is validating product-market fit.",
    ],
    purpose: "Test launch-phase scaling vs. patience recommendations.",
    aiShouldRecommend: "Scale cautiously on early winners; validate fulfillment and margin first.",
  },
  google_outperforms_meta: {
    scenarioId: "google_outperforms_meta",
    title: "Google Outperforming Meta",
    paragraphs: [
      "This is a simulated multi-channel store.",
      "Google Ads delivers stronger ROAS than Meta for the same catalog.",
      "Budget may be misallocated toward weaker social campaigns.",
    ],
    purpose: "Test cross-channel budget shift recommendations.",
    aiShouldRecommend: "Shift budget toward Google while maintaining prospecting on Meta.",
  },
  meta_outperforms_google: {
    scenarioId: "meta_outperforms_google",
    title: "Meta Outperforming Google",
    paragraphs: [
      "This is a simulated multi-channel store.",
      "Meta campaigns outperform Google Search and Shopping on ROAS.",
      "Social prospecting is the primary growth engine.",
    ],
    purpose: "Test Meta scaling and Google efficiency recommendations.",
    aiShouldRecommend: "Scale Meta winners; optimize or reduce underperforming Google campaigns.",
  },
  subscription_churn: {
    scenarioId: "subscription_churn",
    title: "Subscription Business",
    paragraphs: [
      "This is a simulated subscription box business.",
      "Recurring revenue is healthy but churn and refund signals are elevated.",
      "Retention is as important as acquisition.",
    ],
    purpose: "Test retention and subscription health recommendations.",
    aiShouldRecommend: "Retention offers, churn reduction, and LTV-focused campaigns.",
  },
  cash_flow_crisis: {
    scenarioId: "cash_flow_crisis",
    title: "Cash Flow Crisis",
    paragraphs: [
      "This is a simulated cash-constrained store.",
      "Slow inventory ties up working capital while sales have softened.",
      "The merchant needs liquidity, not just growth.",
    ],
    purpose: "Test cash-focused clearance and pricing urgency.",
    aiShouldRecommend: "Aggressive clearance on slow SKUs and pause non-essential ad spend.",
  },
  custom: {
    scenarioId: "custom",
    title: "Custom Scenario",
    paragraphs: [
      "This is a custom simulation built with adjustable parameters.",
      "Metrics reflect the merchant-defined inputs — not a preset template.",
    ],
    purpose: "Test StorePilot against bespoke business conditions.",
    aiShouldRecommend: "Recommendations tailored to the configured scenario parameters.",
  },
};

export function getScenarioNarrative(
  scenarioId: SimulationScenarioId,
  storeLabel?: string,
): SimulationScenarioNarrative {
  const narrative = NARRATIVES[scenarioId];
  if (narrative) return narrative;

  return {
    scenarioId,
    title: storeLabel ?? "Simulation Scenario",
    paragraphs: [
      "This is an artificial business scenario generated by the StorePilot Simulation Engine.",
      "All products, campaigns, and metrics are synthetic — not from a real merchant account.",
    ],
    purpose: "Demonstrate how StorePilot AI analyzes business data and recommends actions.",
    aiShouldRecommend: "Context-appropriate recommendations based on the scenario parameters.",
  };
}

export function formatBusinessModelLabel(model: BusinessModel): string {
  const labels: Record<BusinessModel, string> = {
    own_inventory: "inventory-led store",
    dropshipping: "dropshipping store",
    private_label: "private label store",
    print_on_demand: "print-on-demand store",
    digital_products: "digital products store",
    subscription: "subscription business",
    hybrid: "hybrid commerce business",
  };
  return labels[model] ?? "simulated store";
}
