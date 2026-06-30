import type { AutopilotRuleCategory, AutopilotRuleDefinition } from "./operations-types";

export const AUTOPILOT_CATEGORY_LABELS: Record<AutopilotRuleCategory, string> = {
  advertising: "Advertising",
  inventory: "Inventory",
  store_performance: "Store Performance",
  customer_intelligence: "Customer Intelligence",
  executive_reporting: "Executive Reporting",
};

export const AUTOPILOT_SAFETY_GUARANTEES = [
  "Delete campaigns",
  "Change products",
  "Change pricing",
  "Increase budgets above your maximum",
  "Spend money without an enabled automation rule",
] as const;

/** Catalog of autopilot rules — configuration defaults; live state is computed in operations.ts */
export const AUTOPILOT_RULE_CATALOG: AutopilotRuleDefinition[] = [
  {
    id: "pause_losing_campaigns",
    category: "advertising",
    title: "Pause Losing Campaigns",
    summary:
      "When a campaign stays below the break-even ROAS for seven consecutive days, StorePilot prepares a pause recommendation. You review and approve the action before it is applied.",
    triggerExplanation: "Campaign ROAS remains below break-even for 7+ consecutive days with meaningful spend.",
    actionExplanation: "Queues a pause recommendation in Decisions — never pauses automatically without approval.",
    defaultEnabled: false,
  },
  {
    id: "increase_winning_budgets",
    category: "advertising",
    title: "Increase Winning Budgets",
    summary:
      "When ROAS stays above break-even and conversions are growing, StorePilot suggests a controlled budget increase within your configured ceiling.",
    triggerExplanation: "ROAS exceeds target for 5+ days and conversion trend is positive.",
    actionExplanation: "Prepares a budget increase recommendation capped at your maximum increase setting.",
    defaultEnabled: false,
  },
  {
    id: "detect_creative_fatigue",
    category: "advertising",
    title: "Detect Creative Fatigue",
    summary:
      "Monitors CTR and frequency trends to flag creatives that are losing effectiveness before ROAS collapses.",
    triggerExplanation: "CTR drops 15%+ week-over-week while frequency rises above account average.",
    actionExplanation: "Surfaces a creative refresh recommendation with affected ad sets identified.",
    defaultEnabled: false,
  },
  {
    id: "detect_cpa_spikes",
    category: "advertising",
    title: "Detect CPA Spikes",
    summary:
      "Alerts when cost per acquisition jumps materially above your recent baseline without matching revenue lift.",
    triggerExplanation: "CPA increases 20%+ vs prior 7-day average while conversion volume is flat or down.",
    actionExplanation: "Recommends audience or bid adjustments — requires your approval before changes.",
    defaultEnabled: false,
  },
  {
    id: "detect_roas_decline",
    category: "advertising",
    title: "Detect ROAS Decline",
    summary:
      "Tracks blended and channel ROAS against break-even thresholds and flags efficiency deterioration early.",
    triggerExplanation: "Blended ROAS falls 10%+ week-over-week or drops below break-even.",
    actionExplanation: "Creates a prioritized efficiency review in Decisions with supporting metrics.",
    defaultEnabled: false,
  },
  {
    id: "low_inventory_alerts",
    category: "inventory",
    title: "Low Inventory Alerts",
    summary:
      "Sends alerts when SKUs approach stockout based on current sell-through velocity and days of cover remaining.",
    triggerExplanation: "Any tracked SKU falls below 14 days of cover at current velocity.",
    actionExplanation: "Notifies your team and queues reorder recommendations for approval.",
    defaultEnabled: true,
  },
  {
    id: "overstock_detection",
    category: "inventory",
    title: "Overstock Detection",
    summary:
      "Identifies products with excess inventory relative to demand so you can run promotions or pause acquisition.",
    triggerExplanation: "Inventory cover exceeds 90 days while sell-through is below category median.",
    actionExplanation: "Recommends clearance or bundle strategies — no automatic price changes.",
    defaultEnabled: false,
  },
  {
    id: "slow_moving_products",
    category: "inventory",
    title: "Slow-Moving Products",
    summary:
      "Flags SKUs tying up cash with low 30-day velocity so you can adjust merchandising or ads.",
    triggerExplanation: "Units sold in 30 days below threshold while inventory remains elevated.",
    actionExplanation: "Surfaces merchandising and promotion opportunities in Decisions.",
    defaultEnabled: false,
  },
  {
    id: "reorder_recommendations",
    category: "inventory",
    title: "Reorder Recommendations",
    summary:
      "Prioritizes which products to restock first based on revenue contribution and stockout risk.",
    triggerExplanation: "Top revenue SKUs approach minimum days-of-cover threshold.",
    actionExplanation: "Queues reorder actions with estimated revenue-at-risk if stockout occurs.",
    defaultEnabled: false,
  },
  {
    id: "conversion_drop_detection",
    category: "store_performance",
    title: "Conversion Drop Detection",
    summary:
      "Detects when store conversion rate declines materially so you can fix funnel friction before ad spend is wasted.",
    triggerExplanation: "Conversion rate falls 5%+ week-over-week with stable or rising traffic.",
    actionExplanation: "Alerts with funnel diagnostics and landing-page review recommendations.",
    defaultEnabled: false,
  },
  {
    id: "revenue_anomaly_detection",
    category: "store_performance",
    title: "Revenue Anomaly Detection",
    summary:
      "Compares daily and weekly revenue against expected baselines to catch sudden drops or spikes.",
    triggerExplanation: "Revenue deviates more than 15% from trailing 7-day average without seasonal explanation.",
    actionExplanation: "Investigates channel, inventory, and campaign contributors automatically.",
    defaultEnabled: false,
  },
  {
    id: "aov_decline",
    category: "store_performance",
    title: "AOV Decline",
    summary:
      "Monitors average order value trends to catch mix shifts, discount leakage, or bundle erosion.",
    triggerExplanation: "AOV falls 8%+ week-over-week while order volume is flat or rising.",
    actionExplanation: "Recommends bundle, upsell, or shipping-threshold adjustments for review.",
    defaultEnabled: false,
  },
  {
    id: "traffic_anomaly_detection",
    category: "store_performance",
    title: "Traffic Anomaly Detection",
    summary:
      "Watches session and traffic patterns from GA4 and paid channels for unusual spikes or drops.",
    triggerExplanation: "Sessions change 20%+ week-over-week without matching revenue movement.",
    actionExplanation: "Correlates traffic sources with conversion to isolate tracking or campaign issues.",
    defaultEnabled: false,
  },
  {
    id: "vip_customer_alerts",
    category: "customer_intelligence",
    title: "VIP Customer Alerts",
    summary:
      "Notifies you when high-LTV customers purchase, return, or show signs of disengagement.",
    triggerExplanation: "VIP-segment customer places an order or exceeds inactivity threshold.",
    actionExplanation: "Suggests personalized outreach — never sends customer emails without approval.",
    defaultEnabled: false,
  },
  {
    id: "churn_risk",
    category: "customer_intelligence",
    title: "Churn Risk",
    summary:
      "Identifies repeat buyers who have not purchased within their typical buying cycle.",
    triggerExplanation: "Customer exceeds 90 days since last purchase with prior repeat history.",
    actionExplanation: "Queues win-back campaign recommendations for your review.",
    defaultEnabled: false,
  },
  {
    id: "high_value_purchases",
    category: "customer_intelligence",
    title: "High-Value Customer Purchases",
    summary:
      "Alerts when an order exceeds your high-AOV threshold so you can prioritize fulfillment and retention.",
    triggerExplanation: "Single order value exceeds 2× store AOV.",
    actionExplanation: "Flags order for VIP treatment and loyalty follow-up suggestions.",
    defaultEnabled: false,
  },
  {
    id: "win_back_opportunities",
    category: "customer_intelligence",
    title: "Win-Back Opportunities",
    summary:
      "Surfaces lapsed customers with strong historical LTV who are likely to respond to targeted offers.",
    triggerExplanation: "Customer LTV in top quartile with 60+ days inactive.",
    actionExplanation: "Recommends segment-specific win-back offers — requires campaign approval.",
    defaultEnabled: false,
  },
  {
    id: "daily_summary",
    category: "executive_reporting",
    title: "Daily Executive Summary",
    summary:
      "Delivers a morning brief with revenue, spend, top priorities, and recommended actions from synced data.",
    triggerExplanation: "Scheduled each morning after store sync completes.",
    actionExplanation: "Sends summary notification — no store changes are made.",
    defaultEnabled: true,
  },
  {
    id: "weekly_report",
    category: "executive_reporting",
    title: "Weekly Performance Report",
    summary:
      "Summarizes week-over-week changes across revenue, ROAS, conversion, and inventory for leadership review.",
    triggerExplanation: "Scheduled every Monday after weekly metrics are finalized.",
    actionExplanation: "Delivers report digest — actions still require separate approval.",
    defaultEnabled: false,
  },
  {
    id: "monthly_performance_review",
    category: "executive_reporting",
    title: "Monthly Performance Review",
    summary:
      "Compiles a full-month P&L-oriented review with channel, product, and customer highlights.",
    triggerExplanation: "Scheduled on the first business day of each month.",
    actionExplanation: "Generates executive review — no automated financial or ad changes.",
    defaultEnabled: false,
  },
];

export const AUTOPILOT_CATEGORY_ORDER: AutopilotRuleCategory[] = [
  "advertising",
  "inventory",
  "store_performance",
  "customer_intelligence",
  "executive_reporting",
];
