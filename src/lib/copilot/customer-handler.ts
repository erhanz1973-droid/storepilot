import type { CustomerIntelligenceDashboard } from "@/lib/customers/engine";
import type { CustomerRecord } from "@/lib/customers/types";
import type { CopilotDataSource, CopilotIntent, CopilotStructuredResponse } from "./types";

const CUSTOMER_UNLOCK_CAPABILITIES = [
  "Top Customers by Lifetime Value (LTV)",
  "Highest Revenue Customers",
  "Repeat Buyers",
  "One-Time Buyers",
  "Average Order Value (AOV)",
  "Purchase Frequency",
  "Customer Lifetime Value (LTV)",
  "Customer Cohorts",
  "VIP Customers",
  "Churn Risk Detection",
  "At-Risk Customers",
  "First-Time Customer Conversion",
  "Returning Customer Rate",
  "RFM Segmentation (Recency, Frequency, Monetary)",
  "Geographic Customer Distribution",
] as const;

const CUSTOMER_FUTURE_INSIGHT_EXAMPLES = [
  "Who are my top 20 customers?",
  "Which customers are likely to purchase again?",
  "Which VIP customers have become inactive?",
  "Which customer segments generate the highest profit?",
  "Which customers should receive retention campaigns?",
  "Which customers should receive exclusive offers?",
] as const;

const CUSTOMER_UNAVAILABLE_IMPACT =
  "Customer Intelligence enables better retention, personalized marketing, and higher lifetime value by identifying the customers who contribute the most to long-term revenue.";

function fmt(n: number): string {
  return n.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function daysAgoLabel(dateStr: string): string {
  const days = Math.max(
    0,
    Math.round((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24)),
  );
  if (days === 0) return "today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

function monthsBetween(startIso: string, end = Date.now()): number {
  const start = new Date(startIso).getTime();
  if (Number.isNaN(start)) return 0;
  return Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24 * 30.44)));
}

function hasCustomerRecords(dashboard: CustomerIntelligenceDashboard | null): boolean {
  return (dashboard?.snapshot.customers.length ?? 0) > 0;
}

function topCustomersUnavailable(
  intent: CopilotIntent,
  sources: CopilotDataSource[],
): CopilotStructuredResponse {
  return {
    title: "Customer Intelligence is not available yet",
    summary:
      "StorePilot cannot identify your highest-value customers because Shopify customer and order history have not been synchronized. Once connected, the AI will automatically analyze customer behavior and identify your most valuable buyers.",
    evidence: [{ label: "Customer & order sync", value: "Not connected" }],
    confidencePct: 95,
    unlockCapabilities: [...CUSTOMER_UNLOCK_CAPABILITIES],
    futureInsightExamples: [...CUSTOMER_FUTURE_INSIGHT_EXAMPLES],
    recommendations: [
      {
        action: "Connect Shopify Customers & Orders",
        detail:
          "Sync customer profiles and complete order history to unlock StorePilot Customer Intelligence.",
        available: false,
      },
    ],
    businessImpact: {
      label: CUSTOMER_UNAVAILABLE_IMPACT,
      calculable: true,
    },
    relatedInsights: [],
    dataSourcesUsed: sources,
    intent,
  };
}

function formatCustomerLine(c: CustomerRecord, index: number): string {
  const lines = [
    `${index + 1}. ${c.name}`,
    `   Lifetime Spend: ${fmt(c.lifetimeRevenue)}`,
    `   Orders: ${c.ordersCount}`,
    `   Average Order Value: ${fmt(c.aov)}`,
    `   Last Purchase: ${daysAgoLabel(c.lastPurchaseAt)}`,
  ];
  return lines.join("\n");
}

function averageLtv(customers: CustomerRecord[]): number | null {
  const withLtv = customers.map((c) => c.ltv ?? c.lifetimeRevenue).filter((v) => v > 0);
  if (withLtv.length === 0) return null;
  return Math.round(withLtv.reduce((s, v) => s + v, 0) / withLtv.length);
}

function buildSyncedCustomerInsights(dashboard: CustomerIntelligenceDashboard): string[] {
  const customers = [...dashboard.snapshot.customers].sort(
    (a, b) => b.lifetimeRevenue - a.lifetimeRevenue,
  );
  const top = customers[0];
  if (!top) return [];

  const totalRev = customers.reduce((s, c) => s + c.lifetimeRevenue, 0);
  const top10Count = Math.max(1, Math.ceil(customers.length * 0.1));
  const top10Rev = customers.slice(0, top10Count).reduce((s, c) => s + c.lifetimeRevenue, 0);
  const top10Share = totalRev > 0 ? Math.round((top10Rev / totalRev) * 1000) / 10 : 0;

  const atRisk90 = customers.filter((c) => c.daysSinceLastPurchase > 90).length;
  const repeatBuyers = customers.filter((c) => c.ordersCount >= 2);
  const firstTime = customers.filter((c) => c.ordersCount === 1);
  const repeatLtv = averageLtv(repeatBuyers);
  const firstLtv = averageLtv(firstTime);
  const ltvMultiple =
    repeatLtv != null && firstLtv != null && firstLtv > 0
      ? Math.round((repeatLtv / firstLtv) * 10) / 10
      : null;

  const insights: string[] = [
    `Your top customer has spent **${fmt(top.lifetimeRevenue)}** across **${top.ordersCount} orders** over the past **${monthsBetween(top.firstPurchaseAt)} months**.`,
    `The top **10% of customers** generate **${top10Share}%** of total revenue.`,
  ];

  if (atRisk90 > 0) {
    insights.push(
      `**${atRisk90} customers** are at high risk of churn because they have not purchased in over **90 days**.`,
    );
  }

  if (repeatLtv != null && ltvMultiple != null && ltvMultiple > 1) {
    insights.push(
      `Your highest-value customer segment is **Repeat Buyers**, with an average LTV of **${fmt(repeatLtv)}**, which is **${ltvMultiple}×** higher than first-time customers.`,
    );
  } else if (dashboard.ltv.average != null) {
    insights.push(`Average customer LTV across your synced base is **${fmt(dashboard.ltv.average)}**.`);
  }

  return insights;
}

export function handleCustomerTop(
  dashboard: CustomerIntelligenceDashboard | null,
  sources: CopilotDataSource[],
): CopilotStructuredResponse {
  if (!hasCustomerRecords(dashboard)) {
    return topCustomersUnavailable("customer_top", sources);
  }

  const customers = dashboard!.snapshot.customers
    .slice()
    .sort((a, b) => b.lifetimeRevenue - a.lifetimeRevenue)
    .slice(0, 10);
  const totalRev = dashboard!.snapshot.customers.reduce((s, c) => s + c.lifetimeRevenue, 0);
  const top10Rev = customers.reduce((s, c) => s + c.lifetimeRevenue, 0);
  const top10Share = totalRev > 0 ? Math.round((top10Rev / totalRev) * 1000) / 10 : 0;
  const repeatRate = dashboard!.executiveSummary.repeatPurchaseRate.value;
  const insightLines = buildSyncedCustomerInsights(dashboard!);

  const summary = [
    insightLines.join("\n\n"),
    "",
    "**Top customers**",
    "",
    ...customers.slice(0, 5).map((c, i) => formatCustomerLine(c, i)),
    "",
    "**Recommended actions**",
    "",
    "• Create VIP segment",
    "• Launch loyalty rewards",
    "• Send exclusive offers to top customers",
    repeatRate !== "—" ? `• Repeat customer rate is **${repeatRate}** — prioritize retention on high-LTV buyers` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const evidence = customers.slice(0, 5).map((c) => ({
    label: c.name,
    value: `${fmt(c.lifetimeRevenue)} · ${c.ordersCount} orders · AOV ${fmt(c.aov)}`,
  }));

  return {
    title: "Your top customers",
    summary,
    evidence,
    confidencePct: dashboard!.ltv.status === "verified" ? 92 : 84,
    recommendations: [
      {
        action: "Create VIP segment",
        detail: `${customers.filter((c) => c.segment === "vip").length} VIP customers identified in your synced data.`,
        available: false,
      },
      {
        action: "Launch loyalty rewards",
        detail: `Repeat rate is ${repeatRate}% — loyalty programs typically lift repeat purchases 8–15%.`,
        available: false,
      },
      {
        action: "Send exclusive offers to top customers",
        detail: `Top ${Math.min(5, customers.length)} customers represent ${top10Share}% of sample revenue.`,
        available: false,
      },
    ],
    businessImpact: {
      label: `Top 10 customers · ${top10Share}% of tracked revenue`,
      calculable: true,
      monthlyRevenue: Math.round(top10Rev / 12),
    },
    relatedInsights: [],
    dataSourcesUsed: sources,
    intent: "customer_top",
  };
}

export function handleCustomerIntelligence(
  dashboard: CustomerIntelligenceDashboard | null,
  sources: CopilotDataSource[],
): CopilotStructuredResponse {
  if (!hasCustomerRecords(dashboard)) {
    return topCustomersUnavailable("customer_intelligence", sources);
  }

  const snap = dashboard!.snapshot;
  const vip = snap.customers.filter((c) => c.segment === "vip");
  const atRisk = snap.customers.filter((c) => c.segment === "at_risk" || c.segment === "inactive");
  const repeatMeta = dashboard!.executiveSummary.repeatPurchaseRate;
  const avgOrders = dashboard!.analytics.purchaseFrequency.value;
  const insightLines = buildSyncedCustomerInsights(dashboard!);

  const summary = [
    insightLines.join("\n\n"),
    "",
    `• **${snap.totalCustomers.toLocaleString()}** total customers · **${snap.newCustomers30d.toLocaleString()}** new (30d) · **${snap.returningCustomers30d.toLocaleString()}** returning (30d)`,
    `• Repeat purchase rate: **${repeatMeta.value}** · AOV: **${fmt(snap.aov)}**`,
    dashboard!.ltv.average != null
      ? `• Average LTV: **${fmt(dashboard!.ltv.average!)}** · Purchase frequency: **${avgOrders}**`
      : `• LTV: requires 90+ days of history · Purchase frequency: **${avgOrders}**`,
    `• **${vip.length}** VIP customers · **${dashboard!.analytics.repeatBuyers.value}** repeat buyers · **${dashboard!.analytics.churnRiskCount.value}** at churn risk`,
    "",
    "Open **Analytics → Customers** for segments, cohorts, RFM, and geographic distribution.",
  ].join("\n");

  return {
    title: "Customer Intelligence",
    summary,
    evidence: [
      { label: "Total customers", value: snap.totalCustomers.toLocaleString() },
      { label: "Repeat rate", value: repeatMeta.value },
      { label: "AOV", value: fmt(snap.aov) },
      { label: "VIP customers", value: String(vip.length) },
      { label: "At-risk / inactive", value: String(atRisk.length), trend: atRisk.length > 5 ? "down" : "flat" },
    ],
    confidencePct: 88,
    recommendations: dashboard!.opportunities.slice(0, 3).map((o) => ({
      action: o.title,
      detail: o.description,
      available: false,
    })),
    businessImpact: {
      label: `${dashboard!.analytics.repeatBuyers.value} repeat buyers in active sample`,
      calculable: true,
    },
    relatedInsights: [],
    dataSourcesUsed: sources,
    intent: "customer_intelligence",
  };
}
