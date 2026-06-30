import type { AskAiResponse, BusinessContext } from "@/lib/ai/types";
import { compareProfitPeriods, summarizeProfitForAi } from "@/lib/profit/engine";
import {
  compareWeekMargin,
  explainProfitDecrease,
} from "@/lib/profit/kpi";
import { recordTopic } from "@/lib/ai/session";

function formatCurrency(n: number): string {
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function buildResponse(
  sessionId: string,
  content: string,
): AskAiResponse {
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

export function answerNetProfit(ctx: BusinessContext, sessionId: string): AskAiResponse {
  recordTopic(sessionId, "net_profit");
  const dash = ctx.profitDashboard;
  if (!dash) {
    return buildResponse(
      sessionId,
      "I need Shopify order history and product costs to calculate net profit. Connect your store on **Connected Store**, then open **Net Profit** to add COGS where missing.",
    );
  }

  const p = dash.primary;
  const meta = dash.primaryProfit;

  if (meta.status === "unavailable") {
    return buildResponse(
      sessionId,
      [
        "**Profit is not available** — required cost data is missing.",
        dash.confidence.notice ?? "Complete Profit Setup to unlock profitability analytics.",
        `Missing: ${dash.confidence.missingInputs.join(", ") || "product costs or revenue"}.`,
        "Open **Profit Setup** from the Profit page to configure costs.",
      ].join("\n\n"),
    );
  }

  const profitLabel = meta.status === "estimated" ? "Estimated net profit" : "Net profit";
  const marginSuffix = p.profitMarginPct != null ? ` (${p.profitMarginPct}% margin)` : "";
  const disclaimer =
    meta.status === "estimated" && dash.confidence.notice ? `\n\n_${dash.confidence.notice}_` : "";

  const lines = [
    `**Last 30 days:** ${profitLabel} ${formatCurrency(p.netProfit ?? 0)} on ${formatCurrency(p.revenue)} revenue${marginSuffix}.`,
    `Gross profit: ${formatCurrency(p.grossProfit)} after ${formatCurrency(p.cogs)} COGS.`,
    `Deductions: ${formatCurrency(p.adSpend)} ads · ${formatCurrency(p.transactionFees)} fees · ${formatCurrency(p.shippingCost)} shipping · ${formatCurrency(p.refunds)} refunds.`,
    summarizeProfitForAi(dash),
    "See the full breakdown on **Net Profit**.",
  ];

  return buildResponse(sessionId, lines.join("\n\n") + disclaimer);
}

export function answerProfitDecrease(ctx: BusinessContext, sessionId: string): AskAiResponse {
  recordTopic(sessionId, "profit_decrease");
  const dash = ctx.profitDashboard;
  if (!dash) {
    return buildResponse(sessionId, "Connect Shopify to analyze profit trends.");
  }

  const comparison = compareProfitPeriods(dash);
  const evidence = explainProfitDecrease(dash);
  const lines = [comparison.message, "", "**Evidence:**", ...evidence.map((e) => `• ${e}`)];

  const losing = dash.losingProducts[0];
  if (losing) {
    lines.push(
      "",
      `**Product drag:** ${losing.title} — net profit ${formatCurrency(losing.netProfit)} (${losing.costSource === "estimated" ? "estimated COGS" : "verify COGS or pricing"}).`,
    );
  }

  lines.push("", "Open **Net Profit** for product and channel breakdowns.");

  return buildResponse(sessionId, lines.join("\n"));
}

export function answerProductProfit(ctx: BusinessContext, sessionId: string): AskAiResponse {
  recordTopic(sessionId, "product_profit");
  const dash = ctx.profitDashboard;
  if (!dash) {
    return buildResponse(sessionId, "Connect Shopify to rank products by profit.");
  }

  const lines: string[] = [];

  if (dash.topProfitableProducts.length > 0) {
    lines.push("**Highest profit products (30d):**");
    for (const p of dash.topProfitableProducts.slice(0, 5)) {
      lines.push(
        `• **${p.title}** — ${formatCurrency(p.netProfit)} net profit (${p.marginPct}% margin, ${p.unitsSold} units)`,
      );
    }
  }

  if (dash.losingProducts.length > 0) {
    lines.push("\n**Products losing money:**");
    for (const p of dash.losingProducts) {
      lines.push(
        `• **${p.title}** — ${formatCurrency(p.netProfit)} net (${p.costSource === "estimated" ? "estimated COGS — verify cost" : "review pricing or COGS"})`,
      );
    }
  } else {
    lines.push("\nNo products with negative net profit in the last 30 days.");
  }

  if (dash.assumptions.productsWithEstimatedCost > 0) {
    lines.push(
      `\n_${dash.assumptions.productsWithEstimatedCost} products use estimated costs — add real COGS on Net Profit for accuracy._`,
    );
  }

  return buildResponse(sessionId, lines.join("\n"));
}

export function answerCollectionProfit(ctx: BusinessContext, sessionId: string): AskAiResponse {
  recordTopic(sessionId, "collection_profit");
  const dash = ctx.profitDashboard;
  if (!dash || dash.byCollection.length === 0) {
    return buildResponse(sessionId, "Connect Shopify to rank collections by profit.");
  }

  const top = dash.byCollection[0];
  const lines = [
    `**Most profitable collection (30d): ${top.title}**`,
    `• Revenue: ${formatCurrency(top.revenue)}`,
    `• Net profit: ${formatCurrency(top.netProfit)} (${top.marginPct}% margin)`,
    "",
    "**Other collections:**",
  ];

  for (const c of dash.byCollection.slice(1, 4)) {
    lines.push(`• **${c.title}** — ${formatCurrency(c.netProfit)} net profit (${c.marginPct}% margin)`);
  }

  if (dash.confidence.status === "estimated") {
    lines.push(
      "",
      `_${dash.confidence.notice ?? dash.confidence.reason} — add product costs for verified collection profit._`,
    );
  }

  return buildResponse(sessionId, lines.join("\n"));
}

export function answerMarginWeek(ctx: BusinessContext, sessionId: string): AskAiResponse {
  recordTopic(sessionId, "margin_week");
  const dash = ctx.profitDashboard;
  if (!dash) {
    return buildResponse(sessionId, "Connect Shopify to analyze margin trends.");
  }

  const weekNote = compareWeekMargin(dash);
  const p = dash.primary;
  const last7 = dash.periods.find((w) => w.window === "last7d");
  const lines = [
    weekNote ?? "Margin comparison unavailable.",
    "",
    `**30-day margin:** ${p.profitMarginPct}% on ${formatCurrency(p.revenue)} revenue.`,
  ];

  if (last7) {
    lines.push(
      `**7-day margin:** ${last7.profitMarginPct}% — ad spend ${formatCurrency(last7.adSpend)}, COGS ${formatCurrency(last7.cogs)}.`,
    );
  }

  const evidence = explainProfitDecrease(dash).filter(
    (l) => l.includes("margin") || l.includes("advertising"),
  );
  if (evidence.length > 0) {
    lines.push("", "**Likely drivers:**", ...evidence.map((e) => `• ${e}`));
  }

  return buildResponse(sessionId, lines.join("\n"));
}
