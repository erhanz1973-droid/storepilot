import type { SimulationScenarioDefinition } from "./types";

function p(
  partial: Partial<SimulationScenarioDefinition["params"]> &
    Pick<SimulationScenarioDefinition["params"], "products">,
): SimulationScenarioDefinition["params"] {
  return {
    revenue30d: 15000,
    orders30d: 120,
    conversionRate30d: 2.1,
    metaSpend7d: 2800,
    metaRevenue7d: 6200,
    googleSpend7d: 1400,
    googleRevenue7d: 3800,
    sessions30d: 5200,
    refundRatePct: 2,
    creativeFatigue: "low",
    ...partial,
  };
}

export const SIMULATION_SCENARIOS: SimulationScenarioDefinition[] = [
  {
    id: "dead_inventory",
    label: "Dead Inventory",
    description: "High stock, near-zero velocity SKUs",
    defaultBusinessModel: "own_inventory",
    params: p({
      revenue30d: 8200,
      orders30d: 68,
      products: [
        { id: "sim-dead-1", title: "Aged Moisturizer XL", price: 42, unitCost: 14, inventory: 180, unitsSold30d: 2 },
        { id: "sim-dead-2", title: "Slow Toner", price: 28, unitCost: 8, inventory: 95, unitsSold30d: 4 },
      ],
    }),
    expectedDecisions: [
      { id: "clearance", label: "Clearance / discount", matchKeywords: ["clearance", "discount", "slow", "inventory", "dead"] },
      { id: "bundle", label: "Bundle products", matchKeywords: ["bundle"] },
    ],
    forbiddenDecisionKeywords: [],
  },
  {
    id: "winning_product",
    label: "Winning Product",
    description: "Hero SKU with strong ROAS and velocity",
    defaultBusinessModel: "dropshipping",
    params: p({
      revenue30d: 28000,
      orders30d: 210,
      metaSpend7d: 4200,
      metaRevenue7d: 18000,
      products: [
        { id: "sim-hero-1", title: "Hero Vitamin Serum", price: 48, unitCost: 12, inventory: 0, unitsSold30d: 145 },
        { id: "sim-hero-2", title: "Support SKU", price: 32, unitCost: 9, inventory: 0, unitsSold30d: 22 },
      ],
    }),
    expectedDecisions: [
      { id: "scale", label: "Scale campaign / winner", matchKeywords: ["scale", "winner", "hero", "budget", "roas"] },
    ],
  },
  {
    id: "roas_collapse",
    label: "ROAS Collapse",
    description: "High spend with weak return",
    defaultBusinessModel: "dropshipping",
    params: p({
      metaSpend7d: 5200,
      metaRevenue7d: 3100,
      googleSpend7d: 2100,
      googleRevenue7d: 1400,
      products: [
        { id: "sim-roas-1", title: "Over-advertised SKU", price: 55, unitCost: 18, inventory: 0, unitsSold30d: 18 },
      ],
    }),
    expectedDecisions: [
      { id: "pause", label: "Pause or reduce ads", matchKeywords: ["pause", "reduce", "cpa", "roas", "campaign"] },
    ],
  },
  {
    id: "creative_fatigue",
    label: "Creative Fatigue",
    description: "Declining CTR with sustained spend",
    defaultBusinessModel: "dropshipping",
    params: p({
      metaSpend7d: 3800,
      metaRevenue7d: 4500,
      creativeFatigue: "high",
      products: [
        { id: "sim-cf-1", title: "Fatigued Creative SKU", price: 39, unitCost: 11, inventory: 0, unitsSold30d: 35 },
      ],
    }),
    expectedDecisions: [
      { id: "creative", label: "Creative refresh", matchKeywords: ["creative", "fatigue", "refresh", "ad ", "campaign"] },
    ],
  },
  {
    id: "inventory_overstock",
    label: "Inventory Overstock",
    description: "Excess units relative to sales",
    defaultBusinessModel: "own_inventory",
    params: p({
      products: [
        { id: "sim-over-1", title: "Overstocked Cleanser", price: 34, unitCost: 10, inventory: 240, unitsSold30d: 12 },
      ],
    }),
    expectedDecisions: [
      { id: "overstock", label: "Overstock action", matchKeywords: ["inventory", "overstock", "clearance", "slow", "bundle"] },
    ],
  },
  {
    id: "low_conversion",
    label: "Low Conversion",
    description: "Traffic without checkout efficiency",
    defaultBusinessModel: "digital_products",
    params: p({
      conversionRate30d: 0.8,
      sessions30d: 12000,
      orders30d: 96,
      products: [
        { id: "sim-lc-1", title: "Digital Course", price: 97, unitCost: 5, inventory: 999, unitsSold30d: 40, tags: ["digital"] },
      ],
    }),
    expectedDecisions: [
      { id: "conversion", label: "Conversion optimization", matchKeywords: ["conversion", "checkout", "funnel", "homepage", "promotion"] },
    ],
  },
  {
    id: "high_cpc",
    label: "High CPC",
    description: "Compressed margin from paid traffic",
    defaultBusinessModel: "dropshipping",
    params: p({
      metaSpend7d: 4500,
      metaRevenue7d: 5200,
      products: [
        { id: "sim-cpc-1", title: "High CPC SKU", price: 44, unitCost: 16, inventory: 0, unitsSold30d: 28 },
      ],
    }),
    expectedDecisions: [
      { id: "cpa", label: "CPA / efficiency alert", matchKeywords: ["cpa", "roas", "campaign", "budget", "efficiency"] },
    ],
  },
  {
    id: "scaling_opportunity",
    label: "Scaling Opportunity",
    description: "Profitable campaigns ready to scale",
    defaultBusinessModel: "dropshipping",
    params: p({
      metaSpend7d: 2200,
      metaRevenue7d: 8800,
      googleSpend7d: 900,
      googleRevenue7d: 3600,
      products: [
        { id: "sim-scale-1", title: "Scale Candidate", price: 52, unitCost: 13, inventory: 0, unitsSold30d: 88 },
      ],
    }),
    expectedDecisions: [
      { id: "scale", label: "Scale opportunity", matchKeywords: ["scale", "budget", "winner", "roas", "campaign"] },
    ],
  },
  {
    id: "high_refund_rate",
    label: "High Refund Rate",
    description: "Elevated refunds eroding margin",
    defaultBusinessModel: "own_inventory",
    params: p({
      refundRatePct: 12,
      revenue30d: 14000,
      orders30d: 110,
      products: [
        { id: "sim-ref-1", title: "High Return SKU", price: 58, unitCost: 20, inventory: 40, unitsSold30d: 45 },
      ],
    }),
    expectedDecisions: [
      { id: "refund", label: "Refund / quality issue", matchKeywords: ["refund", "return", "quality", "margin", "product"] },
    ],
  },
  {
    id: "seasonal_demand",
    label: "Seasonal Demand",
    description: "Upcoming seasonal spike opportunity",
    defaultBusinessModel: "own_inventory",
    params: p({
      revenue30d: 18000,
      orders30d: 140,
      products: [
        { id: "sim-season-1", title: "Summer SPF Bundle", price: 44, unitCost: 12, inventory: 80, unitsSold30d: 55, tags: ["seasonal"] },
      ],
    }),
    expectedDecisions: [
      { id: "seasonal", label: "Seasonal prep", matchKeywords: ["season", "promotion", "campaign", "inventory", "stock"] },
    ],
  },
  {
    id: "price_too_high",
    label: "Price Too High",
    description: "Low velocity at premium price point",
    defaultBusinessModel: "own_inventory",
    params: p({
      conversionRate30d: 1.1,
      products: [
        { id: "sim-price-hi", title: "Premium Overpriced Serum", price: 128, unitCost: 28, inventory: 60, unitsSold30d: 6 },
      ],
    }),
    expectedDecisions: [
      { id: "price", label: "Price reduction", matchKeywords: ["price", "discount", "promotion", "conversion", "pricing"] },
    ],
  },
  {
    id: "price_too_low",
    label: "Price Too Low",
    description: "Strong demand with thin margin",
    defaultBusinessModel: "own_inventory",
    params: p({
      conversionRate30d: 4.2,
      products: [
        { id: "sim-price-lo", title: "Underpriced Best Seller", price: 18, unitCost: 9, inventory: 25, unitsSold30d: 95 },
      ],
    }),
    expectedDecisions: [
      { id: "margin", label: "Margin / pricing uplift", matchKeywords: ["price", "margin", "profit", "pricing", "increase"] },
    ],
  },
  {
    id: "organic_growth",
    label: "Organic Growth",
    description: "Direct and organic traffic driving revenue",
    defaultBusinessModel: "digital_products",
    params: p({
      metaSpend7d: 800,
      metaRevenue7d: 1200,
      googleSpend7d: 600,
      googleRevenue7d: 900,
      sessions30d: 18000,
      conversionRate30d: 3.1,
      products: [
        { id: "sim-org-1", title: "Organic Traffic Product", price: 67, unitCost: 4, inventory: 999, unitsSold30d: 72, tags: ["digital"] },
      ],
    }),
    expectedDecisions: [
      { id: "organic", label: "Organic / merchandising", matchKeywords: ["homepage", "merchandising", "organic", "promotion", "conversion"] },
    ],
  },
  {
    id: "launch_campaign",
    label: "Launch Campaign",
    description: "New product launch with early traction",
    defaultBusinessModel: "dropshipping",
    params: p({
      revenue30d: 4200,
      orders30d: 38,
      metaSpend7d: 1600,
      metaRevenue7d: 2800,
      products: [
        { id: "sim-launch-1", title: "New Launch SKU", price: 52, unitCost: 14, inventory: 0, unitsSold30d: 28 },
      ],
    }),
    expectedDecisions: [
      { id: "launch", label: "Launch scaling", matchKeywords: ["campaign", "scale", "budget", "launch", "winner"] },
    ],
  },
  {
    id: "healthy_store",
    label: "Healthy Store",
    description: "Balanced metrics — few critical decisions",
    defaultBusinessModel: "own_inventory",
    params: p({
      revenue30d: 22000,
      orders30d: 185,
      conversionRate30d: 2.8,
      metaSpend7d: 2400,
      metaRevenue7d: 7200,
      products: [
        { id: "sim-ok-1", title: "Steady Seller", price: 38, unitCost: 11, inventory: 45, unitsSold30d: 62 },
      ],
    }),
    expectedDecisions: [],
  },
  {
    id: "google_outperforms_meta",
    label: "Google Outperforming Meta",
    description: "Shift budget toward Google",
    defaultBusinessModel: "dropshipping",
    params: p({
      metaSpend7d: 3200,
      metaRevenue7d: 4100,
      googleSpend7d: 1800,
      googleRevenue7d: 7200,
      products: [
        { id: "sim-gm-1", title: "Search Winner", price: 46, unitCost: 12, inventory: 0, unitsSold30d: 55 },
      ],
    }),
    expectedDecisions: [
      { id: "google", label: "Google / search opportunity", matchKeywords: ["google", "search", "shopping", "campaign", "roas"] },
    ],
  },
  {
    id: "meta_outperforms_google",
    label: "Meta Outperforming Google",
    description: "Meta channel stronger than Google",
    defaultBusinessModel: "dropshipping",
    params: p({
      metaSpend7d: 2800,
      metaRevenue7d: 9800,
      googleSpend7d: 2400,
      googleRevenue7d: 3200,
      products: [
        { id: "sim-mg-1", title: "Social Winner", price: 41, unitCost: 10, inventory: 0, unitsSold30d: 72 },
      ],
    }),
    expectedDecisions: [
      { id: "meta", label: "Meta scaling", matchKeywords: ["meta", "facebook", "campaign", "scale", "budget"] },
    ],
  },
  {
    id: "subscription_churn",
    label: "Subscription Churn",
    description: "Retention risk signals",
    defaultBusinessModel: "subscription",
    params: p({
      revenue30d: 12000,
      orders30d: 95,
      refundRatePct: 8,
      products: [
        { id: "sim-sub-1", title: "Monthly Box Subscription", price: 49, unitCost: 15, inventory: 0, unitsSold30d: 30, tags: ["subscription"] },
      ],
    }),
    expectedDecisions: [
      { id: "retention", label: "Retention / churn", matchKeywords: ["churn", "retention", "subscription", "customer"] },
    ],
  },
  {
    id: "cash_flow_crisis",
    label: "Cash Flow Crisis",
    description: "Cash tied in slow inventory",
    defaultBusinessModel: "own_inventory",
    params: p({
      revenue30d: 6000,
      orders30d: 48,
      products: [
        { id: "sim-cash-1", title: "Cash Trap SKU", price: 60, unitCost: 22, inventory: 150, unitsSold30d: 3 },
      ],
    }),
    expectedDecisions: [
      { id: "cash", label: "Cash / clearance", matchKeywords: ["cash", "clearance", "inventory", "slow", "discount"] },
    ],
  },
];

export const DROPSHIPPING_FORBIDDEN_KEYWORDS = [
  "dead inventory",
  "reorder",
  "restock",
  "warehouse",
  "clearance discount",
  "inventory aging",
  "low inventory alert",
];

export function getScenarioById(id: string): SimulationScenarioDefinition | undefined {
  return SIMULATION_SCENARIOS.find((s) => s.id === id);
}
