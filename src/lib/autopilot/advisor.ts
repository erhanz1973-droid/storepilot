import type { AskAiResponse, BusinessContext } from "@/lib/ai/types";
import { recordTopic } from "@/lib/ai/session";
import type { AutopilotDashboard } from "./types";

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

function requireAutopilot(ctx: BusinessContext): AutopilotDashboard | null {
  return ctx.autopilotDashboard ?? null;
}

function confidenceLine(pct: number): string {
  return `_Confidence: ${pct}% based on synced store, profit, and attribution data._`;
}

export function answerFocusToday(ctx: BusinessContext, sessionId: string): AskAiResponse {
  recordTopic(sessionId, "autopilot_today");
  const ap = requireAutopilot(ctx);
  if (!ap) {
    return buildResponse(sessionId, "Connect Shopify to get your daily action plan. Open **Autopilot**.");
  }

  const lines = [
    `**${ap.executiveBrief.headline}**`,
    "",
    "**Top 3 actions (by net profit impact):**",
  ];
  for (const a of ap.actions.slice(0, 3)) {
    lines.push(
      `• **${a.title}** — +$${a.expectedNetProfitGain.toLocaleString()}/mo · ${a.priority} · ${Math.round(a.confidenceScore * 100)}% confidence · ~${a.estimatedMinutes} min`,
    );
  }
  if (ap.alerts[0]) {
    lines.push("", `**Alert:** ${ap.alerts[0].title} — ${ap.alerts[0].suggestedAction}`);
  }
  lines.push("", confidenceLine(ap.executiveBrief.confidencePct));
  return buildResponse(sessionId, lines.join("\n"));
}

export function answerBiggestProblem(ctx: BusinessContext, sessionId: string): AskAiResponse {
  recordTopic(sessionId, "autopilot_problem");
  const ap = requireAutopilot(ctx);
  if (!ap) {
    return buildResponse(sessionId, "Connect your store to diagnose the biggest profit drag.");
  }

  const critical = ap.alerts.find((a) => a.severity === "Critical") ?? ap.alerts[0];
  const losing = ap.actions.find((a) => a.source === "alert" || a.priority === "Critical");

  const lines = ["**Biggest problem right now:**"];
  if (critical) {
    lines.push(`• **${critical.title}**`, `  _${critical.reason}_`, `  Impact: ${critical.businessImpact}`, `  → ${critical.suggestedAction}`);
  } else if (losing) {
    lines.push(`• **${losing.title}** — ${losing.businessImpact}`);
  } else {
    lines.push("No critical issues — focus on scaling top profit opportunities.");
  }
  lines.push("", `Executive health: **${ap.executiveHealth.score}/100** (${ap.executiveHealth.label})`);
  lines.push(...ap.executiveHealth.changeReasons.map((r) => `• ${r}`));
  lines.push("", confidenceLine(ap.executiveBrief.confidencePct));
  return buildResponse(sessionId, lines.join("\n"));
}

export function answerFastestProfit(ctx: BusinessContext, sessionId: string): AskAiResponse {
  recordTopic(sessionId, "autopilot_fast_profit");
  const ap = requireAutopilot(ctx);
  if (!ap) {
    return buildResponse(sessionId, "Connect Shopify for profit acceleration recommendations.");
  }

  const quick = ap.actions
    .filter((a) => a.estimatedMinutes <= 20)
    .sort((a, b) => b.expectedNetProfitGain - a.expectedNetProfitGain)
    .slice(0, 4);

  const lines = ["**Fastest path to more net profit:**"];
  for (const a of quick) {
    lines.push(`• **${a.title}** — +$${a.expectedNetProfitGain.toLocaleString()}/mo · ~${a.estimatedMinutes} min`);
  }
  lines.push("", confidenceLine(ap.executiveBrief.confidencePct));
  return buildResponse(sessionId, lines.join("\n"));
}

export function answerWastingMoney(ctx: BusinessContext, sessionId: string): AskAiResponse {
  recordTopic(sessionId, "autopilot_waste");
  const ap = requireAutopilot(ctx);
  if (!ap) {
    return buildResponse(sessionId, "Connect store data to find waste.");
  }

  const waste = [
    ...ap.alerts.filter((a) => ["roas_drop", "margin_deterioration", "campaign_fatigue"].includes(a.type)),
    ...ap.actions.filter((a) => a.source === "budget" && a.title.toLowerCase().includes("pause")),
  ].slice(0, 4);

  if (waste.length === 0) {
    return buildResponse(sessionId, "No major waste detected — ad spend and margins look reasonable.");
  }

  const lines = ["**Where you may be wasting money:**"];
  for (const item of waste) {
    if ("suggestedAction" in item) {
      lines.push(`• **${item.title}** — ${item.reason} → ${item.suggestedAction}`);
    } else {
      lines.push(`• **${item.title}** — ${item.description}`);
    }
  }
  lines.push("", confidenceLine(ap.executiveBrief.confidencePct));
  return buildResponse(sessionId, lines.join("\n"));
}

export function answerStopDoing(ctx: BusinessContext, sessionId: string): AskAiResponse {
  recordTopic(sessionId, "autopilot_stop");
  const ap = requireAutopilot(ctx);
  if (!ap) {
    return buildResponse(sessionId, "Connect your store for deprioritization guidance.");
  }

  const stop = ap.budgetRecommendations.filter((b) => b.action === "pause_campaign" || b.action === "reduce_budget");
  const losing = ctx.productIntelligence?.losingMoney.slice(0, 2) ?? [];

  const lines = ["**Consider stopping or reducing:**"];
  for (const b of stop) {
    lines.push(`• **${b.target}** — ${b.reasoning}`);
  }
  for (const p of losing) {
    lines.push(`• **Ads/promos for ${p.title}** — losing $${Math.abs(p.netProfit).toLocaleString()} net`);
  }
  if (stop.length === 0 && losing.length === 0) {
    lines.push("Nothing flagged for immediate stop — maintain current mix.");
  }
  lines.push("", confidenceLine(ap.executiveBrief.confidencePct));
  return buildResponse(sessionId, lines.join("\n"));
}

export function answerInvestNext(ctx: BusinessContext, sessionId: string): AskAiResponse {
  recordTopic(sessionId, "autopilot_invest");
  const ap = requireAutopilot(ctx);
  if (!ap) {
    return buildResponse(sessionId, "Connect Shopify and Meta for investment recommendations.");
  }

  const invest = ap.actions
    .filter((a) => a.expectedNetProfitGain > 0 && a.confidenceScore >= 0.7)
    .slice(0, 4);

  const lines = ["**Best investments for net profit:**"];
  for (const a of invest) {
    lines.push(`• **${a.title}** — +$${a.expectedNetProfitGain.toLocaleString()}/mo expected · ${Math.round(a.confidenceScore * 100)}% confidence`);
  }
  lines.push("", confidenceLine(ap.executiveBrief.confidencePct));
  return buildResponse(sessionId, lines.join("\n"));
}
