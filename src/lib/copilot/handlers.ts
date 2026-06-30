import { explainRoasDecrease } from "@/lib/profit/roas";
import { analyzeSalesTrends } from "@/lib/ai/sales-trends";
import type { CopilotDataBundle } from "./data";
import { handleCustomerIntelligence, handleCustomerTop } from "./customer-handler";
import { buildCopilotRiskResponse } from "./risk-handler";
import { findMatchingInsights, insightToEvidence } from "./insights";
import { INTENT_DATA_SOURCES } from "./intents";
import {
  averageConfidence,
  buildBusinessImpactFromInsights,
  mergeEvidence,
  recommendationsFromInsights,
} from "./response";
import { buildValidatedStoreInsight } from "./insight-engine";
import { buildWeeklyChangeInsight } from "./weekly-insight-engine";
import type { CopilotDataSource, CopilotIntent, CopilotStructuredResponse } from "./types";
import type { SupportingMetric } from "@/lib/types";

function pctChange(current: number, previous: number): number | null {
  if (previous <= 0) return current > 0 ? 100 : null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function insufficient(sources: CopilotDataSource[], intent: CopilotIntent): CopilotStructuredResponse {
  return {
    title: "Store performance overview",
    summary: "I don't have enough synced data to answer that confidently. Connect Shopify and your ad platforms, then try again.",
    evidence: [{ label: "Data status", value: "Insufficient synced metrics" }],
    confidencePct: 35,
    recommendations: [],
    businessImpact: { label: "", calculable: false, reasonIfNot: "Cannot estimate without store data." },
    relatedInsights: [],
    dataSourcesUsed: sources,
    intent,
  };
}

export function handleCopilotIntent(
  intent: CopilotIntent,
  bundle: CopilotDataBundle,
): CopilotStructuredResponse {
  const { context, storeManager, storeHealth, snapshot, predictiveInsights } = bundle;
  const sources = intentDataSources(intent);
  const feed = storeManager.opportunityFeed;
  const matched = findMatchingInsights(intent, feed);

  switch (intent) {
    case "sales_yesterday":
      return handleSalesYesterday(bundle, sources, matched);
    case "sales_decrease":
      return handleSalesDecrease(bundle, sources, matched);
    case "roas_decrease":
      return handleRoasDecrease(bundle, sources, matched);
    case "roas_meta_compare":
      return handleRoasMetaCompare(bundle, sources);
    case "roas_google":
      return handleRoasGoogle(bundle, sources, matched);
    case "pause_campaigns":
      return handlePauseCampaigns(bundle, sources, matched);
    case "today":
      return handleToday(bundle, sources, matched);
    case "product_ads_budget":
      return handleProductAdsBudget(bundle, sources, matched);
    case "product_profit_hurt":
      return handleProductProfitHurt(bundle, sources, matched);
    case "what_changed_week":
      return handleWhatChangedWeek(bundle, sources, matched);
    case "biggest_opportunities":
      return handleBiggestOpportunities(bundle, sources, feed.slice(0, 5));
    case "biggest_risk":
      return buildCopilotRiskResponse(bundle, sources);
    case "best_channel":
      return handleBestChannel(bundle, sources, matched);
    case "store_health_explain":
      return handleStoreHealth(bundle, sources);
    case "predict_revenue":
      return handlePredictRevenue(bundle, sources, predictiveInsights);
    case "restock":
      return handleRestock(bundle, sources, matched);
    case "profit_decrease":
      return handleProfitDecrease(bundle, sources, matched);
    case "customer_top":
      return handleCustomerTop(bundle.customerIntelligence, sources);
    case "customer_intelligence":
      return handleCustomerIntelligence(bundle.customerIntelligence, sources);
    case "product_intelligence":
      return handleProductIntelligence(bundle, sources, matched);
    case "inventory_intelligence":
      return handleInventoryIntelligence(bundle, sources, matched);
    case "marketing_intelligence":
      return handleMarketingIntelligence(bundle, sources, matched);
    default:
      return handleGeneral(bundle, sources, matched);
  }
}

function intentDataSources(intent: import("./types").CopilotIntent): CopilotDataSource[] {
  if (intent === "today") {
    return ["shopify", "google_ads", "meta_ads", "insights", "priority_queue", "trends", "profit", "store_health"];
  }
  return INTENT_DATA_SOURCES[intent] ?? ["insights", "trends", "profit"];
}

function handleSalesYesterday(
  bundle: CopilotDataBundle,
  sources: CopilotDataSource[],
  matched: ReturnType<typeof findMatchingInsights>,
): CopilotStructuredResponse {
  const rollups = bundle.snapshot.profitRollups;
  if (!rollups) return insufficient(sources, "sales_yesterday");

  const yesterday = rollups.yesterday.revenue;
  const today = rollups.today.revenue;
  const change = pctChange(yesterday, today * 0.95);
  const evidence: SupportingMetric[] = [
    { label: "Yesterday revenue", value: `$${Math.round(yesterday).toLocaleString()}` },
    { label: "Today revenue (partial)", value: `$${Math.round(today).toLocaleString()}` },
  ];

  const google = bundle.snapshot.googleAdsSnapshot;
  if (google) {
    const convChange = pctChange(google.rollups.yesterday.orders, google.rollups.today.orders);
    if (convChange != null) {
      evidence.push({
        label: "Google conversions",
        value: `${convChange > 0 ? "+" : ""}${convChange}%`,
        trend: convChange >= 0 ? "up" : "down",
      });
    }
  }

  const metaCampaigns = bundle.snapshot.campaigns.filter((c) => c.spend7d > 50);
  if (metaCampaigns.length > 0) {
    const avgCtr = metaCampaigns.reduce((s, c) => s + c.ctr7d, 0) / metaCampaigns.length;
    evidence.push({ label: "Meta avg CTR (7d)", value: `${avgCtr.toFixed(2)}%` });
  }

  const summary =
    change != null && change < -3
      ? `Sales decreased yesterday because revenue was $${Math.round(yesterday).toLocaleString()} (${Math.abs(change).toFixed(0)}% below the recent daily run-rate).`
      : change != null && change > 3
        ? `Yesterday revenue was $${Math.round(yesterday).toLocaleString()}, up ${change.toFixed(0)}% vs the prior day trend.`
        : `Yesterday revenue was $${Math.round(yesterday).toLocaleString()} — relatively stable vs recent days.`;

  return {
    summary,
    evidence: mergeEvidence(evidence, matched.flatMap(insightToEvidence)),
    confidencePct: rollups ? 88 : 45,
    recommendations: recommendationsFromInsights(matched),
    businessImpact: buildBusinessImpactFromInsights(matched),
    relatedInsights: matched.map((m) => ({ id: m.id, title: m.title, source: m.source })),
    dataSourcesUsed: [...sources, "shopify", "google_ads", "meta_ads"],
    intent: "sales_yesterday",
  };
}

function handleSalesDecrease(
  bundle: CopilotDataBundle,
  sources: CopilotDataSource[],
  matched: ReturnType<typeof findMatchingInsights>,
): CopilotStructuredResponse {
  const trends = analyzeSalesTrends(bundle.context.salesTrends);
  const insight = buildValidatedStoreInsight({
    snapshot: bundle.snapshot,
    profitDashboard: bundle.context.profitDashboard,
    trends: bundle.storeManager.trends,
    opportunities: bundle.storeManager.opportunityFeed,
  });

  if (!trends.hasSufficientHistory && insight.bottleneck === "overview") {
    return insufficient(sources, "sales_decrease");
  }

  const fromInsights = recommendationsFromInsights(matched);
  const recommendations =
    fromInsights.length > 0
      ? fromInsights
      : [
          {
            action: insight.title,
            detail: insight.recommendation,
            available: false,
          },
        ];

  return {
    title: insight.title,
    summary: insight.summary,
    evidence: mergeEvidence(insight.evidence, matched.flatMap(insightToEvidence)),
    confidencePct: insight.metricsConflict
      ? Math.min(averageConfidence(matched, insight.confidencePct), insight.confidencePct)
      : averageConfidence(matched, insight.confidencePct),
    recommendations,
    businessImpact: buildBusinessImpactFromInsights(matched),
    relatedInsights: matched.map((m) => ({ id: m.id, title: m.title, source: m.source })),
    dataSourcesUsed: sources,
    intent: "sales_decrease",
    bottleneck: insight.bottleneck,
    metricsConflict: insight.metricsConflict,
  };
}

function handleRoasDecrease(
  bundle: CopilotDataBundle,
  sources: CopilotDataSource[],
  matched: ReturnType<typeof findMatchingInsights>,
): CopilotStructuredResponse {
  const dash = bundle.context.profitDashboard?.blendedRoas;
  if (!dash) return insufficient(sources, "roas_decrease");

  const roasEvidence: SupportingMetric[] = explainRoasDecrease(dash).map((line) => {
    const parts = line.split(":");
    return parts.length >= 2
      ? { label: parts[0].trim(), value: parts.slice(1).join(":").trim() }
      : { label: "ROAS factor", value: line };
  });

  const roas7 = bundle.storeManager.trends.metrics.find((m) => m.id === "roas_7d");
  if (roas7?.changePct != null) {
    roasEvidence.unshift({
      label: "ROAS WoW",
      value: `${roas7.changePct > 0 ? "+" : ""}${roas7.changePct.toFixed(1)}%`,
      trend: roas7.changePct >= 0 ? "up" : "down",
    });
  }

  const pauseInsights = matched.filter((m) => m.futureAction === "pause_campaign" || m.futureAction === "reduce_budget");
  const summary = roas7 && roas7.changePct != null && roas7.changePct < -5
    ? `ROAS decreased ${Math.abs(roas7.changePct).toFixed(0)}% week over week. Blended ROAS is ${dash.blendedRoas30d?.toFixed(2) ?? "—"} on $${dash.periods.find((p) => p.window === "last30d")?.adSpend.toLocaleString() ?? "0"} spend.`
    : `Blended ROAS is ${dash.blendedRoas30d?.toFixed(2) ?? "—"} — review underperforming campaigns before scaling spend.`;

  return {
    summary,
    evidence: mergeEvidence(roasEvidence, matched.flatMap(insightToEvidence)),
    confidencePct: averageConfidence(matched, dash.confidence.level === "High" ? 90 : 78),
    recommendations: recommendationsFromInsights(pauseInsights.length > 0 ? pauseInsights : matched),
    businessImpact: buildBusinessImpactFromInsights(matched),
    relatedInsights: matched.map((m) => ({ id: m.id, title: m.title, source: m.source })),
    dataSourcesUsed: ["google_ads", "meta_ads", "profit", "insights", "trends"],
    intent: "roas_decrease",
  };
}

function handleRoasMetaCompare(bundle: CopilotDataBundle, sources: CopilotDataSource[]): CopilotStructuredResponse {
  const dash = bundle.context.profitDashboard?.blendedRoas;
  if (!dash) return insufficient(sources, "roas_meta_compare");

  const evidence: SupportingMetric[] = [
    { label: "Meta ROAS (30d)", value: dash.metaRoas30d?.toFixed(2) ?? "N/A" },
    { label: "Blended ROAS (30d)", value: dash.blendedRoas30d?.toFixed(2) ?? "N/A" },
  ];
  const organic = dash.channels.find((c) => c.channelId === "organic");
  if (organic) {
    evidence.push({
      label: "Organic revenue share",
      value: `${organic.shareOfRevenuePct}%`,
    });
  }

  const summary =
    dash.metaRoas30d != null && dash.blendedRoas30d != null && dash.metaRoas30d > dash.blendedRoas30d
      ? `Meta ROAS (${dash.metaRoas30d.toFixed(2)}) is higher than Blended ROAS (${dash.blendedRoas30d.toFixed(2)}) because Meta only counts platform-attributed purchases.`
      : `Meta and Blended ROAS are aligned — paid and organic channels are working together.`;

  return {
    summary,
    evidence,
    confidencePct: 85,
    recommendations: [],
    businessImpact: { label: "", calculable: false, reasonIfNot: "Comparison only — no action impact estimated." },
    relatedInsights: [],
    dataSourcesUsed: ["meta_ads", "profit", "attribution"],
    intent: "roas_meta_compare",
  };
}

function handleRoasGoogle(
  bundle: CopilotDataBundle,
  sources: CopilotDataSource[],
  matched: ReturnType<typeof findMatchingInsights>,
): CopilotStructuredResponse {
  const google = bundle.snapshot.googleAdsSnapshot;
  const googleInsights = matched.filter((m) => m.source === "google_ads");
  if (!google && googleInsights.length === 0) return insufficient(sources, "roas_google");

  const evidence: SupportingMetric[] = google
    ? [
        {
          label: "Google ROAS (7d)",
          value: (google.rollups.last7d.attributedRevenue / Math.max(google.rollups.last7d.spend, 1)).toFixed(2),
        },
        { label: "Google spend (7d)", value: `$${google.rollups.last7d.spend.toLocaleString()}` },
      ]
    : [];

  const top = googleInsights[0];
  const summary = top
    ? `Google Ads: ${top.description}`
    : google
      ? `Google Ads ROAS (7d) is ${(google.rollups.last7d.attributedRevenue / Math.max(google.rollups.last7d.spend, 1)).toFixed(2)} on $${google.rollups.last7d.spend.toLocaleString()} spend.`
      : "No Google Ads data synced.";

  return {
    summary,
    evidence: mergeEvidence(evidence, googleInsights.flatMap(insightToEvidence)),
    confidencePct: averageConfidence(googleInsights, 80),
    recommendations: recommendationsFromInsights(googleInsights),
    businessImpact: buildBusinessImpactFromInsights(googleInsights),
    relatedInsights: googleInsights.map((m) => ({ id: m.id, title: m.title, source: m.source })),
    dataSourcesUsed: ["google_ads", "insights"],
    intent: "roas_google",
  };
}

function handlePauseCampaigns(
  bundle: CopilotDataBundle,
  sources: CopilotDataSource[],
  matched: ReturnType<typeof findMatchingInsights>,
): CopilotStructuredResponse {
  const pauseCandidates = matched.filter(
    (m) =>
      m.futureAction === "pause_campaign" ||
      m.futureAction === "reduce_budget" ||
      m.title.toLowerCase().includes("pause") ||
      m.title.toLowerCase().includes("zero conversion"),
  );

  if (pauseCandidates.length === 0) {
    const campaignRecs = bundle.context.activeRecommendations.filter((r) => r.category === "campaign_review");
    if (campaignRecs.length === 0) {
      return {
        summary: "No campaigns currently flagged for pausing. All active campaigns are within acceptable ROAS thresholds.",
        evidence: [{ label: "Active campaigns", value: String(bundle.context.campaigns.length) }],
        confidencePct: 75,
        recommendations: [],
        businessImpact: { label: "", calculable: false, reasonIfNot: "No pause actions recommended." },
        relatedInsights: [],
        dataSourcesUsed: sources,
        intent: "pause_campaigns",
      };
    }
  }

  const targets = pauseCandidates.length > 0 ? pauseCandidates : matched;
  const top = targets[0];
  const summary = top
    ? `Pause or reduce: ${top.title}. ${top.description}`
    : "Review campaign portfolio for underperformers.";

  return {
    summary,
    evidence: targets.flatMap(insightToEvidence).slice(0, 6),
    confidencePct: averageConfidence(targets, 90),
    recommendations: recommendationsFromInsights(targets),
    businessImpact: buildBusinessImpactFromInsights(targets),
    relatedInsights: targets.map((m) => ({ id: m.id, title: m.title, source: m.source })),
    dataSourcesUsed: ["google_ads", "meta_ads", "insights", "priority_queue"],
    intent: "pause_campaigns",
  };
}

function handleToday(
  bundle: CopilotDataBundle,
  sources: CopilotDataSource[],
  matched: ReturnType<typeof findMatchingInsights>,
): CopilotStructuredResponse {
  const queue = bundle.storeManager.priorityQueue;
  const top = queue[0];
  const critical = queue.filter((q) => q.priority === "critical");

  const summary = critical.length > 0
    ? `Today: address ${critical[0].title} first, then work through ${queue.length} prioritized actions.`
    : top
      ? `Today: ${top.title} — ${top.summary}`
      : "No urgent actions detected. Review opportunities to grow profit.";

  const evidence: SupportingMetric[] = queue.slice(0, 4).map((q) => ({
    label: q.priority.toUpperCase(),
    value: q.title.slice(0, 60),
  }));

  return {
    summary,
    evidence: mergeEvidence(evidence, matched.flatMap(insightToEvidence)),
    confidencePct: averageConfidence(matched, top?.confidence ?? 85),
    recommendations: recommendationsFromInsights(matched.length > 0 ? matched : feedToRecs(bundle)),
    businessImpact: buildBusinessImpactFromInsights(matched.length > 0 ? matched : bundle.storeManager.opportunityFeed.slice(0, 3)),
    relatedInsights: matched.map((m) => ({ id: m.id, title: m.title, source: m.source })),
    dataSourcesUsed: ["insights", "priority_queue", "store_health", "trends", "profit"],
    intent: "today",
  };
}

function feedToRecs(bundle: CopilotDataBundle) {
  return bundle.storeManager.opportunityFeed.slice(0, 3);
}

function handleProductAdsBudget(
  bundle: CopilotDataBundle,
  sources: CopilotDataSource[],
  matched: ReturnType<typeof findMatchingInsights>,
): CopilotStructuredResponse {
  const productInsights = matched.filter(
    (m) => m.category === "product_ads" || m.source === "shopify",
  );
  const products = bundle.context.productIntelligence?.hiddenWinners ?? [];

  const evidence: SupportingMetric[] = productInsights.flatMap(insightToEvidence);
  if (products.length > 0 && evidence.length < 4) {
    evidence.push({
      label: "Hidden winner",
      value: `${products[0].title} (${products[0].marginPct}% margin)`,
      trend: "up",
    });
  }

  const top = productInsights[0];
  const summary = top
    ? `${top.title} deserves more ad budget — ${top.description}`
    : products.length > 0
      ? `Increase ad coverage for ${products[0].title} (${products[0].marginPct}% margin, strong unit economics).`
      : "Connect product intelligence to identify SKUs worth scaling.";

  return {
    summary,
    evidence: evidence.slice(0, 6),
    confidencePct: averageConfidence(productInsights, 76),
    recommendations: recommendationsFromInsights(productInsights),
    businessImpact: buildBusinessImpactFromInsights(productInsights),
    relatedInsights: productInsights.map((m) => ({ id: m.id, title: m.title, source: m.source })),
    dataSourcesUsed: sources,
    intent: "product_ads_budget",
  };
}

function handleProductProfitHurt(
  bundle: CopilotDataBundle,
  sources: CopilotDataSource[],
  matched: ReturnType<typeof findMatchingInsights>,
): CopilotStructuredResponse {
  const losing = bundle.context.productIntelligence?.losingMoney ?? [];
  const profitRows = bundle.context.profitDashboard?.losingProducts ?? [];

  const worst = losing[0] ?? profitRows[0];
  if (!worst) {
    return {
      summary: "No products are currently flagged as profit-negative in your synced data.",
      evidence: [{ label: "Products analyzed", value: String(bundle.context.productCount) }],
      confidencePct: 70,
      recommendations: [],
      businessImpact: { label: "", calculable: false, reasonIfNot: "No losing products detected." },
      relatedInsights: [],
      dataSourcesUsed: sources,
      intent: "product_profit_hurt",
    };
  }

  const title = worst.title;
  const profit = worst.netProfit;
  const evidence: SupportingMetric[] = [
    { label: "Net profit (30d)", value: `$${Math.round(profit).toLocaleString()}`, trend: "down" },
  ];

  return {
    summary: `${title} is hurting profit with $${Math.round(profit).toLocaleString()} net profit over 30 days — review COGS, pricing, and ad spend.`,
    evidence: mergeEvidence(evidence, matched.flatMap(insightToEvidence)),
    confidencePct: 88,
    recommendations: recommendationsFromInsights(matched),
    businessImpact: buildBusinessImpactFromInsights(matched),
    relatedInsights: matched.map((m) => ({ id: m.id, title: m.title, source: m.source })),
    dataSourcesUsed: ["shopify", "profit", "insights"],
    intent: "product_profit_hurt",
  };
}

function handleWhatChangedWeek(
  bundle: CopilotDataBundle,
  sources: CopilotDataSource[],
  matched: ReturnType<typeof findMatchingInsights>,
): CopilotStructuredResponse {
  const weekly = buildWeeklyChangeInsight({
    snapshot: bundle.snapshot,
    profitDashboard: bundle.context.profitDashboard,
    trends: bundle.storeManager.trends,
    opportunities: bundle.storeManager.opportunityFeed,
  });

  const fromInsights = recommendationsFromInsights(matched);
  const recommendations =
    fromInsights.length > 0
      ? fromInsights
      : [
          {
            action: weekly.title,
            detail: weekly.recommendation,
            available: false,
          },
        ];

  return {
    title: weekly.title,
    summary: weekly.summary,
    whyItHappened: weekly.whyItHappened,
    evidence: mergeEvidence(weekly.evidence, matched.flatMap(insightToEvidence)),
    confidencePct: averageConfidence(matched, weekly.confidencePct),
    recommendations,
    businessImpact: buildBusinessImpactFromInsights(matched),
    relatedInsights: matched.map((m) => ({ id: m.id, title: m.title, source: m.source })),
    dataSourcesUsed: ["trends", "shopify", "google_ads", "meta_ads", "profit"],
    intent: "what_changed_week",
    bottleneck: weekly.bottleneck,
  };
}

function handleBiggestOpportunities(
  bundle: CopilotDataBundle,
  sources: CopilotDataSource[],
  top: ReturnType<typeof findMatchingInsights>,
): CopilotStructuredResponse {
  if (top.length === 0) {
    return insufficient(sources, "biggest_opportunities");
  }

  const summary = `Your top ${top.length} opportunities could add an estimated $${top.reduce((s, o) => s + o.expectedImpact.profitMonthly + o.expectedImpact.revenueMonthly * 0.3, 0).toLocaleString()}/month combined. Lead with: ${top[0].title}.`;

  return {
    summary,
    evidence: top.flatMap(insightToEvidence).slice(0, 8),
    confidencePct: averageConfidence(top, 85),
    recommendations: recommendationsFromInsights(top),
    businessImpact: buildBusinessImpactFromInsights(top),
    relatedInsights: top.map((m) => ({ id: m.id, title: m.title, source: m.source })),
    dataSourcesUsed: ["insights", "priority_queue"],
    intent: "biggest_opportunities",
  };
}

function handleBestChannel(
  bundle: CopilotDataBundle,
  sources: CopilotDataSource[],
  matched: ReturnType<typeof findMatchingInsights>,
): CopilotStructuredResponse {
  const attr = bundle.context.attributionDashboard;
  const channelInsights = matched.filter((m) => m.category === "channel_comparison");

  if (attr?.acquisition.bestAcquisitionChannel) {
    const bestName = attr.acquisition.bestAcquisitionChannel;
    const channelRow = attr.channels.find((c) => c.channelLabel === bestName || c.channelId.includes(bestName.toLowerCase()));
    return {
      summary: `${bestName} is your best-performing marketing channel with ROAS ${channelRow?.roas?.toFixed(2) ?? attr.acquisition.newCustomerRoas?.toFixed(2) ?? "—"}.`,
      evidence: [
        { label: "Best channel", value: bestName, trend: "up" },
        { label: "Store CAC", value: attr.acquisition.cac != null ? `$${attr.acquisition.cac.toFixed(0)}` : "—" },
        { label: "LTV:CAC", value: attr.acquisition.ltvCacRatio?.toFixed(1) ?? "—" },
        { label: "New customers", value: String(attr.acquisition.newCustomers) },
      ],
      confidencePct: 86,
      recommendations: recommendationsFromInsights(channelInsights),
      businessImpact: buildBusinessImpactFromInsights(channelInsights),
      relatedInsights: channelInsights.map((m) => ({ id: m.id, title: m.title, source: m.source })),
      dataSourcesUsed: ["attribution", "google_ads", "meta_ads"],
      intent: "best_channel",
    };
  }

  const top = channelInsights[0];
  return {
    summary: top?.description ?? "Connect attribution data to compare channel performance.",
    evidence: channelInsights.flatMap(insightToEvidence),
    confidencePct: averageConfidence(channelInsights, 70),
    recommendations: recommendationsFromInsights(channelInsights),
    businessImpact: buildBusinessImpactFromInsights(channelInsights),
    relatedInsights: channelInsights.map((m) => ({ id: m.id, title: m.title, source: m.source })),
    dataSourcesUsed: sources,
    intent: "best_channel",
  };
}

function handleStoreHealth(bundle: CopilotDataBundle, sources: CopilotDataSource[]): CopilotStructuredResponse {
  const health = bundle.storeHealth;
  const evidence: SupportingMetric[] = health.factors.map((f) => ({
    label: f.label,
    value: `${f.score}/100`,
  }));

  if (health.changes.length > 0) {
    for (const c of health.changes.slice(0, 3)) {
      evidence.push({
        label: c.delta > 0 ? "Improved" : "Declined",
        value: c.reason,
        trend: c.delta > 0 ? "up" : "down",
      });
    }
  }

  const summary = `Store Health is ${health.score}/100 (${health.label}). ${health.score >= 85 ? "Your store is healthy." : health.score >= 65 ? "Some areas need attention." : "Several dimensions are below target."}`;

  return {
    summary,
    evidence,
    confidencePct: 90,
    recommendations: recommendationsFromInsights(
      bundle.storeManager.opportunityFeed.filter((o) => o.severity === "critical" || o.severity === "high").slice(0, 2),
    ),
    businessImpact: buildBusinessImpactFromInsights(
      bundle.storeManager.opportunityFeed.slice(0, 2),
    ),
    relatedInsights: [],
    dataSourcesUsed: ["store_health", "trends", "profit", "insights"],
    intent: "store_health_explain",
  };
}

function handlePredictRevenue(
  bundle: CopilotDataBundle,
  sources: CopilotDataSource[],
  predictions: import("@/lib/predictions/engine").PredictiveInsight[],
): CopilotStructuredResponse {
  const rev = predictions.find((p) => p.type === "revenue_forecast");
  if (!rev) {
    return {
      summary: "Connect Shopify and sync daily metrics to enable revenue forecasting.",
      evidence: [{ label: "Forecast", value: "Unavailable" }],
      confidencePct: 40,
      recommendations: [],
      businessImpact: { label: "", calculable: false, reasonIfNot: "Need 14+ days of daily metrics." },
      relatedInsights: [],
      dataSourcesUsed: sources,
      intent: "predict_revenue",
    };
  }

  return {
    summary: `${rev.title}: ${rev.prediction} over the next ${rev.horizonDays} days.`,
    evidence: rev.supportingData.map((d) => ({ label: d.label, value: d.value })),
    confidencePct: rev.confidencePct,
    recommendations: [],
    businessImpact: {
      label: rev.prediction,
      calculable: true,
      monthlyRevenue: undefined,
    },
    relatedInsights: [],
    dataSourcesUsed: ["shopify", "trends", "predictions"],
    intent: "predict_revenue",
  };
}

function handleRestock(
  bundle: CopilotDataBundle,
  sources: CopilotDataSource[],
  matched: ReturnType<typeof findMatchingInsights>,
): CopilotStructuredResponse {
  const inventoryInsights = matched.filter((m) => m.category === "inventory" || m.futureAction === "restock_product");
  const lowStock = bundle.context.lowStockProducts;

  if (inventoryInsights.length === 0 && lowStock.length === 0) {
    return insufficient(sources, "restock");
  }

  const top = inventoryInsights[0];
  const low = lowStock[0];
  const summary = top
    ? top.description
    : low
      ? `Restock ${low.title} — only ${low.daysOfCover.toFixed(0)} days of cover remaining.`
      : "Review inventory for restock priorities.";

  const evidence: SupportingMetric[] = top
    ? insightToEvidence(top)
    : low
      ? [
          { label: "Product", value: low.title },
          { label: "Days of cover", value: low.daysOfCover.toFixed(1), trend: "down" },
          { label: "Units on hand", value: String(low.inventory) },
        ]
      : [];

  return {
    summary,
    evidence,
    confidencePct: averageConfidence(inventoryInsights, 85),
    recommendations: recommendationsFromInsights(inventoryInsights),
    businessImpact: buildBusinessImpactFromInsights(inventoryInsights),
    relatedInsights: inventoryInsights.map((m) => ({ id: m.id, title: m.title, source: m.source })),
    dataSourcesUsed: ["shopify", "insights"],
    intent: "restock",
  };
}

function handleProfitDecrease(
  bundle: CopilotDataBundle,
  sources: CopilotDataSource[],
  matched: ReturnType<typeof findMatchingInsights>,
): CopilotStructuredResponse {
  const profit = bundle.context.profitDashboard?.primary;
  if (!profit || profit.netProfit == null || profit.profitMarginPct == null) {
    return insufficient(sources, "profit_decrease");
  }

  const marginTrend = bundle.storeManager.trends.metrics.find((m) => m.id === "revenue_7d");
  const evidence: SupportingMetric[] = [
    { label: "Net margin (30d)", value: `${profit.profitMarginPct.toFixed(1)}%` },
    { label: "Net profit (30d)", value: `$${Math.round(profit.netProfit).toLocaleString()}` },
    { label: "Ad spend (30d)", value: `$${Math.round(profit.adSpend).toLocaleString()}` },
  ];
  if (marginTrend?.changePct != null) {
    evidence.push({
      label: "Revenue WoW",
      value: `${marginTrend.changePct > 0 ? "+" : ""}${marginTrend.changePct.toFixed(1)}%`,
      trend: marginTrend.changePct >= 0 ? "up" : "down",
    });
  }

  return {
    summary: `Net profit is $${Math.round(profit.netProfit).toLocaleString()} at ${profit.profitMarginPct.toFixed(1)}% margin. Review COGS, ad spend, and discounting if margin compressed.`,
    evidence: mergeEvidence(evidence, matched.flatMap(insightToEvidence)),
    confidencePct: averageConfidence(matched, 84),
    recommendations: recommendationsFromInsights(matched),
    businessImpact: buildBusinessImpactFromInsights(matched),
    relatedInsights: matched.map((m) => ({ id: m.id, title: m.title, source: m.source })),
    dataSourcesUsed: ["profit", "shopify", "trends"],
    intent: "profit_decrease",
  };
}

function handleGeneral(
  bundle: CopilotDataBundle,
  sources: CopilotDataSource[],
  matched: ReturnType<typeof findMatchingInsights>,
): CopilotStructuredResponse {
  const top = bundle.storeManager.priorityQueue[0];
  const summary = top
    ? `Based on your store data: ${top.title}. ${top.summary}`
    : `Store Health ${bundle.storeHealth.score}/100. Ask about sales, ROAS, campaigns, inventory, customers, or opportunities.`;

  return {
    summary,
    evidence: mergeEvidence(
      top ? [{ label: "Top priority", value: top.title }] : [],
      matched.flatMap(insightToEvidence),
    ),
    confidencePct: averageConfidence(matched, top?.confidence ?? 72),
    recommendations: recommendationsFromInsights(matched),
    businessImpact: buildBusinessImpactFromInsights(matched),
    relatedInsights: matched.map((m) => ({ id: m.id, title: m.title, source: m.source })),
    dataSourcesUsed: sources,
    intent: "general",
  };
}

function handleProductIntelligence(
  bundle: CopilotDataBundle,
  sources: CopilotDataSource[],
  matched: ReturnType<typeof findMatchingInsights>,
): CopilotStructuredResponse {
  const intel = bundle.context.productIntelligence;
  if (!intel || intel.products.length === 0) {
    return {
      summary: "Connect Shopify product and order data to analyze bestsellers, margins, and merchandising opportunities.",
      evidence: [{ label: "Product data", value: "Not synced" }],
      confidencePct: 40,
      recommendations: [],
      businessImpact: { label: "", calculable: false, reasonIfNot: "Product intelligence requires synced catalog data." },
      relatedInsights: [],
      dataSourcesUsed: sources,
      intent: "product_intelligence",
    };
  }

  const top = [...intel.products].sort((a, b) => b.netProfit - a.netProfit)[0];
  const losing = intel.losingMoney[0];
  const summary = top
    ? `**Product Intelligence** — Top profit driver: **${top.title}** ($${Math.round(top.netProfit).toLocaleString()} net profit, ${top.marginPct}% margin).${losing ? ` Biggest drag: **${losing.title}** ($${Math.round(losing.netProfit).toLocaleString()}).` : ""} Open **Analytics → Products** for the full catalog.`
    : "Review product profitability in Analytics → Products.";

  return {
    summary,
    evidence: intel.products.slice(0, 4).map((p) => ({
      label: p.title.slice(0, 40),
      value: `$${Math.round(p.revenue).toLocaleString()} rev · ${p.marginPct}% margin`,
    })),
    confidencePct: 86,
    recommendations: recommendationsFromInsights(matched),
    businessImpact: buildBusinessImpactFromInsights(matched),
    relatedInsights: matched.map((m) => ({ id: m.id, title: m.title, source: m.source })),
    dataSourcesUsed: sources,
    intent: "product_intelligence",
  };
}

function handleInventoryIntelligence(
  bundle: CopilotDataBundle,
  sources: CopilotDataSource[],
  matched: ReturnType<typeof findMatchingInsights>,
): CopilotStructuredResponse {
  const dead = bundle.context.slowProducts.filter((p) => p.inventory > 50 && p.unitsSold30d < 5);
  const lowStock = bundle.context.lowStockProducts;

  if (dead.length === 0 && lowStock.length === 0 && matched.length === 0) {
    return insufficient(sources, "inventory_intelligence");
  }

  const summary =
    dead.length > 0
      ? `**Inventory Intelligence** — ${dead.length} SKUs flagged as dead/slow inventory. Lead with **${dead[0]!.title}** (${dead[0]!.inventory} units, ${dead[0]!.unitsSold30d} sold in 30d).`
      : lowStock.length > 0
        ? `**Inventory Intelligence** — ${lowStock.length} SKUs need restock. Priority: **${lowStock[0]!.title}** (~${lowStock[0]!.daysOfCover.toFixed(0)} days of cover).`
        : matched[0]?.description ?? "Review inventory risks in Analytics → Inventory.";

  return {
    summary,
    evidence: [
      ...(dead[0]
        ? [{ label: "Dead inventory SKU", value: dead[0].title }]
        : []),
      ...(lowStock[0]
        ? [{ label: "Low stock SKU", value: `${lowStock[0].title} · ${lowStock[0].daysOfCover.toFixed(0)}d cover`, trend: "down" as const }]
        : []),
    ],
    confidencePct: averageConfidence(matched, 84),
    recommendations: recommendationsFromInsights(matched),
    businessImpact: buildBusinessImpactFromInsights(matched),
    relatedInsights: matched.map((m) => ({ id: m.id, title: m.title, source: m.source })),
    dataSourcesUsed: sources,
    intent: "inventory_intelligence",
  };
}

function handleMarketingIntelligence(
  bundle: CopilotDataBundle,
  sources: CopilotDataSource[],
  matched: ReturnType<typeof findMatchingInsights>,
): CopilotStructuredResponse {
  const dash = bundle.context.profitDashboard?.blendedRoas;
  const attr = bundle.context.attributionDashboard;

  if (!dash && matched.length === 0) {
    return insufficient(sources, "marketing_intelligence");
  }

  const googleRoas30d =
    dash?.channels.find((c) => c.channelId === "google_ads")?.roas ?? null;

  const summary = dash
    ? `**Marketing Intelligence** — Blended ROAS **${dash.blendedRoas30d?.toFixed(2) ?? "—"}** · Meta **${dash.metaRoas30d?.toFixed(2) ?? "—"}** · Google **${googleRoas30d?.toFixed(2) ?? "—"}**. Best channel: **${attr?.acquisition.bestAcquisitionChannel ?? "connect attribution"}**.`
    : matched[0]?.description ?? "Connect ad platforms for marketing intelligence.";

  return {
    summary,
    evidence: [
      ...(dash?.blendedRoas30d != null
        ? [{ label: "Blended ROAS (30d)", value: dash.blendedRoas30d.toFixed(2) }]
        : []),
      ...(dash?.metaRoas30d != null ? [{ label: "Meta ROAS", value: dash.metaRoas30d.toFixed(2) }] : []),
      ...(attr?.acquisition.bestAcquisitionChannel
        ? [{ label: "Best channel", value: attr.acquisition.bestAcquisitionChannel, trend: "up" as const }]
        : []),
    ],
    confidencePct: averageConfidence(matched, dash?.confidence.level === "High" ? 88 : 78),
    recommendations: recommendationsFromInsights(matched),
    businessImpact: buildBusinessImpactFromInsights(matched),
    relatedInsights: matched.map((m) => ({ id: m.id, title: m.title, source: m.source })),
    dataSourcesUsed: sources,
    intent: "marketing_intelligence",
  };
}
