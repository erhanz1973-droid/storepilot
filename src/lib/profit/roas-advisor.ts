import type { AskAiResponse, BusinessContext } from "@/lib/ai/types";
import { recordTopic } from "@/lib/ai/session";
import {
  explainRoasDecrease,
  summarizeRoasForAi,
} from "@/lib/profit/roas";

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

function roasDash(ctx: BusinessContext) {
  return ctx.profitDashboard?.blendedRoas ?? null;
}

export function answerRoasDecrease(ctx: BusinessContext, sessionId: string): AskAiResponse {
  recordTopic(sessionId, "roas_decrease");
  const dash = roasDash(ctx);
  if (!dash) {
    return buildResponse(sessionId, "Connect Shopify and Meta Ads to analyze ROAS trends.");
  }

  const evidence = explainRoasDecrease(dash);
  const lines = ["**Why ROAS changed:**", "", ...evidence.map((e) => `• ${e}`)];
  return buildResponse(sessionId, lines.join("\n"));
}

export function answerMetaVsBlended(ctx: BusinessContext, sessionId: string): AskAiResponse {
  recordTopic(sessionId, "meta_vs_blended");
  const dash = roasDash(ctx);
  if (!dash) {
    return buildResponse(sessionId, "Connect your store to compare Meta ROAS vs Blended ROAS.");
  }

  const lines = [
    "**Meta ROAS vs Blended ROAS**",
    "",
    `• **Meta-attributed ROAS (30d):** ${dash.metaRoas30d?.toFixed(2) ?? "N/A"} — revenue Meta claims from ads ÷ Meta spend.`,
    `• **Blended ROAS (30d):** ${dash.blendedRoas30d?.toFixed(2) ?? "N/A"} — total Shopify revenue ÷ total ad spend.`,
    "",
  ];

  if (dash.metaRoas30d != null && dash.blendedRoas30d != null) {
    if (dash.metaRoas30d > dash.blendedRoas30d) {
      lines.push(
        "Meta ROAS is higher because it only counts platform-attributed purchases. Blended ROAS includes organic, direct, and email revenue that Meta does not claim — so the business-wide number is typically lower but more honest about overall ad efficiency.",
      );
    } else {
      lines.push(
        "Blended ROAS meets or exceeds Meta ROAS — your paid and organic channels are working together efficiently.",
      );
    }
  }

  const organic = dash.channels.find((c) => c.channelId === "organic");
  if (organic && organic.revenue > 0) {
    lines.push(
      "",
      `Organic & direct revenue (30d): $${organic.revenue.toLocaleString()} (${organic.shareOfRevenuePct}% of total) — this lifts Blended ROAS above underperforming paid-only metrics.`,
    );
  }

  return buildResponse(sessionId, lines.join("\n"));
}

export function answerIncreaseAdSpend(ctx: BusinessContext, sessionId: string): AskAiResponse {
  recordTopic(sessionId, "increase_ad_spend");
  const dash = roasDash(ctx);
  if (!dash) {
    return buildResponse(sessionId, "Connect ads to evaluate whether scaling spend makes sense.");
  }

  const lines = [
    summarizeRoasForAi(dash),
    "",
  ];

  if (dash.isAdvertisingProfitable && (dash.blendedRoas30d ?? 0) >= 2) {
    lines.push(
      "**Recommendation:** Yes — consider a modest budget increase (10–20%) on campaigns with ROAS ≥ 2 and frequency below 3. Monitor Blended ROAS daily for 5 days.",
    );
  } else if ((dash.blendedRoas30d ?? 0) >= 1) {
    lines.push(
      "**Recommendation:** Proceed cautiously — Blended ROAS is above breakeven but not strong enough for aggressive scaling. Fix underperforming campaigns first (see Advertising Efficiency opportunities).",
    );
  } else {
    lines.push(
      "**Recommendation:** No — do not increase spend yet. Blended ROAS is below 1.0, meaning ad spend exceeds attributable business revenue. Pause or reduce losing campaigns first.",
    );
  }

  const topAdOpp = ctx.topOpportunities.find((o) => o.category === "advertising_efficiency");
  if (topAdOpp) {
    lines.push("", `Top action: **${topAdOpp.title}** — est. $${topAdOpp.estimatedMonthlyNetProfitImpact.toLocaleString()}/mo net profit.`);
  }

  return buildResponse(sessionId, lines.join("\n"));
}

export function answerAdProfitable(ctx: BusinessContext, sessionId: string): AskAiResponse {
  recordTopic(sessionId, "ad_profitable");
  const dash = roasDash(ctx);
  if (!dash) {
    return buildResponse(sessionId, "Connect Shopify and Meta Ads to assess advertising profitability.");
  }

  const p = ctx.profitDashboard?.primary;
  const lines = [
    summarizeRoasForAi(dash),
    "",
    dash.isAdvertisingProfitable
      ? "**Yes — advertising is profitable.** Total Shopify revenue exceeds total ad spend with room for margin after COGS and fees."
      : "**Not yet — advertising is not clearly profitable.** Ad spend is eating into net profit. Review channel breakdown and pause underperformers.",
  ];

  if (p) {
    lines.push(
      "",
      `**Evidence (30d):** $${p.revenue.toLocaleString()} revenue · $${p.adSpend.toLocaleString()} ad spend · ${p.profitMarginPct}% net margin.`,
    );
  }

  if (dash.confidence.insufficientHistory) {
    lines.push("", `_${dash.confidence.reason}_`);
  }

  return buildResponse(sessionId, lines.join("\n"));
}

export function answerBestChannel(ctx: BusinessContext, sessionId: string): AskAiResponse {
  recordTopic(sessionId, "best_channel");
  const dash = roasDash(ctx);
  if (!dash) {
    return buildResponse(sessionId, "Connect your store to compare channel performance.");
  }

  const paid = dash.channels
    .filter((c) => c.connected && c.spend > 0)
    .sort((a, b) => (b.roas ?? 0) - (a.roas ?? 0));

  const lines = ["**Channel performance (30d):**", ""];

  for (const ch of dash.channels.filter((c) => c.revenue > 0 || c.spend > 0)) {
    lines.push(
      `• **${ch.channel}** — spend ${ch.spend > 0 ? `$${ch.spend.toLocaleString()}` : "$0"}, revenue $${ch.revenue.toLocaleString()}${ch.roas != null ? `, ROAS ${ch.roas.toFixed(2)}` : ""}`,
    );
  }

  if (paid[0]) {
    lines.push("", `**Best paid channel:** ${paid[0].channel} (ROAS ${paid[0].roas?.toFixed(2)}).`);
  }

  const organic = dash.channels.find((c) => c.channelId === "organic");
  if (organic && organic.shareOfRevenuePct > 40) {
    lines.push(
      `**Note:** ${organic.shareOfRevenuePct}% of revenue is organic/direct — paid ads support but don't drive the majority of sales.`,
    );
  }

  return buildResponse(sessionId, lines.join("\n"));
}
