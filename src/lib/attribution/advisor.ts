import type { AskAiResponse, BusinessContext } from "@/lib/ai/types";
import { recordTopic } from "@/lib/ai/session";
import type { AttributionDashboard } from "./models";

function formatCurrency(n: number): string {
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function buildResponse(sessionId: string, content: string): AskAiResponse {
  return {
    message: {
      id: crypto.randomUUID(),
      role: "assistant",
      content,
      createdAt: new Date().toISOString(),
    },
    sessionId,
  };
}

function requireAttr(ctx: BusinessContext): AttributionDashboard | null {
  return ctx.attributionDashboard ?? null;
}

function confidenceLine(score: number): string {
  return `_Confidence: ${Math.round(score * 100)}% (${score >= 0.75 ? "High" : score >= 0.5 ? "Medium" : "Low"} attribution confidence)._`;
}

export function answerCampaignsMoreBudget(ctx: BusinessContext, sessionId: string): AskAiResponse {
  recordTopic(sessionId, "attr_budget");
  const attr = requireAttr(ctx);
  if (!attr) {
    return buildResponse(sessionId, "Connect Shopify and Meta Ads to rank campaigns by attributed profit. Open **Attribution**.");
  }

  const candidates = attr.campaigns.filter((c) => c.netProfit > 0).slice(0, 4);
  const lines = ["**Campaigns that deserve more budget (by net profit):**"];
  for (const c of candidates) {
    lines.push(
      `• **${c.campaignName}** — ${formatCurrency(c.netProfit)} net profit, ROAS ${c.roas?.toFixed(2) ?? "—"}, CPA ${c.cpa != null ? formatCurrency(c.cpa) : "—"}`,
    );
  }
  lines.push("", confidenceLine(attr.confidence.scorePct / 100));
  return buildResponse(sessionId, lines.join("\n"));
}

export function answerCreativesToPause(ctx: BusinessContext, sessionId: string): AskAiResponse {
  recordTopic(sessionId, "attr_pause_creative");
  const attr = requireAttr(ctx);
  if (!attr) {
    return buildResponse(sessionId, "Connect your store to analyze creative-level attribution.");
  }

  const pause = attr.creatives.filter((c) => c.recommendation === "pause" || c.status === "underperforming");
  if (pause.length === 0) {
    return buildResponse(sessionId, "No creatives flagged for pause — all are at or above profit thresholds.");
  }

  const lines = ["**Creatives to pause or refresh:**"];
  for (const c of pause.slice(0, 4)) {
    lines.push(
      `• **${c.creativeName}** (${c.campaignName}) — profit ${formatCurrency(c.profit)}, ROAS ${c.roas?.toFixed(2) ?? "—"}, CTR ${c.ctr}%`,
    );
  }
  lines.push("", confidenceLine(attr.confidence.scorePct / 100));
  return buildResponse(sessionId, lines.join("\n"));
}

export function answerBestAcquisitionChannel(ctx: BusinessContext, sessionId: string): AskAiResponse {
  recordTopic(sessionId, "attr_acquisition");
  const attr = requireAttr(ctx);
  if (!attr) {
    return buildResponse(sessionId, "Connect Shopify and ads to compare acquisition channels.");
  }

  const ranked = [...attr.channels]
    .filter((c) => c.newCustomerRevenue > 0)
    .sort((a, b) => b.attributedProfit - a.attributedProfit);

  const lines = [
    `**Best acquisition channel:** ${attr.acquisition.bestAcquisitionChannel ?? ranked[0]?.channelLabel ?? "—"}`,
    `Store CAC: ${attr.acquisition.cac != null ? formatCurrency(attr.acquisition.cac) : "—"} · LTV:CAC ${attr.acquisition.ltvCacRatio ?? "—"}`,
    "",
    "**Channels by attributed profit:**",
  ];
  for (const c of ranked.slice(0, 4)) {
    lines.push(
      `• **${c.channelLabel}** — ${formatCurrency(c.attributedProfit)} profit, ${formatCurrency(c.newCustomerRevenue)} new-customer revenue, CAC ${c.cac != null ? formatCurrency(c.cac) : "—"}`,
    );
  }
  lines.push("", confidenceLine(attr.confidence.scorePct / 100));
  return buildResponse(sessionId, lines.join("\n"));
}

export function answerMetaRevenueDecline(ctx: BusinessContext, sessionId: string): AskAiResponse {
  recordTopic(sessionId, "attr_meta_decline");
  const attr = requireAttr(ctx);
  const trends = ctx.salesTrends;
  if (!attr || !trends) {
    return buildResponse(sessionId, "Need synced sales and attribution data to explain Meta revenue changes.");
  }

  const meta = attr.channels.find((c) => c.channelId === "meta_ads");
  const monthChange = trends.last30Days.revenue - trends.previous30Days.revenue;
  const lines = [
    monthChange < 0
      ? `Store revenue is down ${formatCurrency(Math.abs(monthChange))} vs the prior 30 days.`
      : "Store revenue has not declined vs the prior 30 days.",
  ];

  if (meta) {
    lines.push(
      "",
      `**Meta (attributed):** ${formatCurrency(meta.attributedRevenue)} revenue, ${formatCurrency(meta.attributedProfit)} profit, ROAS ${meta.roas?.toFixed(2) ?? "—"}.`,
      `Assisted revenue: ${formatCurrency(meta.assistedRevenue)} (${meta.assistRatePct}% assist rate).`,
    );
  }

  const weak = attr.worstCampaigns[0];
  if (weak && weak.netProfit < 0) {
    lines.push(`**Drag:** ${weak.campaignName} — ${formatCurrency(weak.netProfit)} net profit.`);
  }

  lines.push("", confidenceLine(attr.confidence.scorePct / 100));
  return buildResponse(sessionId, lines.join("\n"));
}

export function answerRevenueNotProfitCampaigns(ctx: BusinessContext, sessionId: string): AskAiResponse {
  recordTopic(sessionId, "attr_rev_not_profit");
  const attr = requireAttr(ctx);
  if (!attr) {
    return buildResponse(sessionId, "Connect Shopify to compare campaign revenue vs profit.");
  }

  const gap = attr.campaigns.filter((c) => c.attributedRevenue > 500 && c.netProfit < 0);
  if (gap.length === 0) {
    return buildResponse(sessionId, "All major campaigns are net-profitable on attributed revenue.");
  }

  const lines = ["**Campaigns with revenue but negative net profit:**"];
  for (const c of gap.slice(0, 4)) {
    lines.push(
      `• **${c.campaignName}** — ${formatCurrency(c.attributedRevenue)} revenue, ${formatCurrency(c.netProfit)} net profit, spend ${formatCurrency(c.adSpend)}`,
    );
  }
  lines.push("", confidenceLine(attr.confidence.scorePct / 100));
  return buildResponse(sessionId, lines.join("\n"));
}

export function answerAssistedTouchpoints(ctx: BusinessContext, sessionId: string): AskAiResponse {
  recordTopic(sessionId, "attr_assisted");
  const attr = requireAttr(ctx);
  if (!attr) {
    return buildResponse(sessionId, "Connect your store to analyze assisted conversions.");
  }

  const lines = ["**Top assist channels (multi-touch influence):**"];
  for (const c of attr.assistedLeaders.slice(0, 4)) {
    lines.push(
      `• **${c.channelLabel}** — ${formatCurrency(c.assistedRevenue)} assisted revenue, ${c.assistRatePct}% assist rate, ${c.multiTouchContributionPct}% multi-touch contribution`,
    );
  }
  lines.push("", confidenceLine(attr.confidence.scorePct / 100));
  return buildResponse(sessionId, lines.join("\n"));
}
