import type { AskAiResponse, BusinessContext } from "@/lib/ai/types";
import { summarizeProductAttributionForAi } from "@/lib/attribution/product-engine";
import { recordTopic } from "@/lib/ai/session";
import type { ProductIntelligenceDashboard } from "./types";

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

function requireIntel(ctx: BusinessContext): ProductIntelligenceDashboard | null {
  return ctx.productIntelligence ?? null;
}

function confidenceLine(score: number): string {
  return `_Confidence: ${Math.round(score * 100)}% based on synced order, cost, and ad data._`;
}

export function answerMostProfitableProducts(ctx: BusinessContext, sessionId: string): AskAiResponse {
  recordTopic(sessionId, "product_profit");
  const intel = requireIntel(ctx);
  if (!intel) {
    return buildResponse(sessionId, "Connect Shopify to rank products by net profit. Open **Products** after connecting.");
  }

  const lines = ["**Most profitable products (last 30 days):**"];
  for (const p of intel.products.slice(0, 5)) {
    lines.push(
      `• **${p.title}** — ${formatCurrency(p.netProfit)} net profit (${p.marginPct}% margin, ROAS ${p.productRoas?.toFixed(2) ?? "—"}, ${p.unitsSold} units)`,
    );
  }
  lines.push("", confidenceLine(0.88));
  lines.push("See full profiles on **Products**.");
  return buildResponse(sessionId, lines.join("\n"));
}

export function answerProductsNeedMoreAds(ctx: BusinessContext, sessionId: string): AskAiResponse {
  recordTopic(sessionId, "product_ads");
  const intel = requireIntel(ctx);
  if (!intel) {
    return buildResponse(sessionId, "Connect Shopify and Meta Ads to identify ad-worthy SKUs.");
  }

  const candidates = [
    ...intel.hiddenWinners,
    ...intel.products.filter((p) => p.marginPct >= 35 && p.netProfit > 0 && (p.productRoas ?? 0) >= 2),
  ]
    .filter((p, i, arr) => arr.findIndex((x) => x.productId === p.productId) === i)
    .slice(0, 4);

  if (candidates.length === 0) {
    return buildResponse(
      sessionId,
      "No clear ad-scaling candidates — improve margins or conversion before increasing spend.",
    );
  }

  const lines = ["**Products that deserve more advertising:**"];
  for (const p of candidates) {
    const attr = ctx.productAttribution?.byProductId[p.productId];
    const attrNote = attr
      ? ` (${attr.primaryTrafficSource}, ${attr.methodLabel}, ${attr.confidencePct}% attribution confidence)`
      : "";
    lines.push(
      `• **${p.title}** — ${p.marginPct}% margin, ${formatCurrency(p.netProfit)} net profit, ${formatCurrency(p.adCost)} ad cost (ROAS ${p.productRoas?.toFixed(2) ?? "—"})${attrNote}`,
    );
    if (attr && attr.sources.organic > attr.sources.meta + attr.sources.google) {
      lines.push(
        `  _This product is highly profitable through organic traffic — scale carefully on paid channels._`,
      );
    }
    if (p.hiddenWinnerReason) lines.push(`  _${p.hiddenWinnerReason}_`);
  }
  if (ctx.productAttribution) {
    lines.push("", summarizeProductAttributionForAi(ctx.productAttribution));
  } else {
    lines.push("", confidenceLine(0.79));
  }
  return buildResponse(sessionId, lines.join("\n"));
}

export function answerProductsLosingMoney(ctx: BusinessContext, sessionId: string): AskAiResponse {
  recordTopic(sessionId, "product_losing");
  const intel = requireIntel(ctx);
  if (!intel) {
    return buildResponse(sessionId, "Connect Shopify to identify unprofitable SKUs.");
  }

  if (intel.losingMoney.length === 0) {
    return buildResponse(
      sessionId,
      "No products are losing money after allocated COGS, shipping, fees, refunds, and ad spend in the last 30 days.",
    );
  }

  const lines = ["**Products losing money (30d):**"];
  for (const p of intel.losingMoney) {
    const attr = ctx.productAttribution?.byProductId[p.productId];
    const channelNote =
      attr && attr.sources.meta > 0 && attr.sources.organic > attr.sources.meta
        ? " — profitable via organic but losing on Meta Ads"
        : attr
          ? ` — ${attr.methodLabel} (${attr.confidencePct}% attribution confidence)`
          : "";
    lines.push(
      `• **${p.title}** — ${formatCurrency(p.netProfit)} net (${p.marginPct}% margin, ${formatCurrency(p.adCost)} ads, ${p.refundRatePct}% refund rate)${channelNote}`,
    );
  }
  if (ctx.productAttribution) {
    lines.push("", summarizeProductAttributionForAi(ctx.productAttribution));
  } else {
    lines.push("", confidenceLine(0.85));
  }
  return buildResponse(sessionId, lines.join("\n"));
}

export function answerProductProfitDecrease(ctx: BusinessContext, sessionId: string): AskAiResponse {
  recordTopic(sessionId, "product_profit_decrease");
  const intel = requireIntel(ctx);
  if (!intel) {
    return buildResponse(sessionId, "Connect Shopify to analyze product profit trends.");
  }

  const declining = intel.products
    .filter((p) => (p.trends.profitGrowthPct ?? 0) < -5)
    .sort((a, b) => (a.trends.profitGrowthPct ?? 0) - (b.trends.profitGrowthPct ?? 0))
    .slice(0, 4);

  if (declining.length === 0) {
    return buildResponse(sessionId, "No products show a significant profit decrease vs the prior 30 days.");
  }

  const lines = ["**Products with declining profit:**"];
  for (const p of declining) {
    const drivers: string[] = [];
    if ((p.trends.revenueGrowthPct ?? 0) < 0) drivers.push(`revenue ${p.trends.revenueGrowthPct}%`);
    if ((p.trends.refundTrendPct ?? 0) > 5) drivers.push(`refunds up ${p.trends.refundTrendPct}%`);
    if ((p.trends.marginTrendPct ?? 0) < -3) drivers.push(`margin down ${p.trends.marginTrendPct} pts`);
    lines.push(
      `• **${p.title}** — profit ${p.trends.profitGrowthPct}% (${formatCurrency(p.netProfit)} now)${drivers.length ? `: ${drivers.join(", ")}` : ""}`,
    );
  }
  lines.push("", confidenceLine(0.74));
  return buildResponse(sessionId, lines.join("\n"));
}

export function answerProductsToRestock(ctx: BusinessContext, sessionId: string): AskAiResponse {
  recordTopic(sessionId, "product_restock");
  const intel = requireIntel(ctx);
  if (!intel) {
    return buildResponse(sessionId, "Connect Shopify to forecast stockouts by SKU.");
  }

  const urgent = intel.products
    .filter((p) => p.inventoryRisk === "low_stock" && p.netProfit > 0)
    .sort((a, b) => (a.daysUntilStockout ?? 999) - (b.daysUntilStockout ?? 999))
    .slice(0, 5);

  if (urgent.length === 0) {
    return buildResponse(sessionId, "No profitable SKUs are at immediate stockout risk.");
  }

  const lines = ["**Restock these products first:**"];
  for (const p of urgent) {
    lines.push(
      `• **${p.title}** — ~${p.daysUntilStockout} days until stockout (${p.inventory} units, ${p.unitsSold} sold/30d, ${formatCurrency(p.netProfit)} net profit)`,
    );
  }
  lines.push("", confidenceLine(0.86));
  return buildResponse(sessionId, lines.join("\n"));
}

export function answerProductsToBundle(ctx: BusinessContext, sessionId: string): AskAiResponse {
  recordTopic(sessionId, "product_bundle");
  const intel = requireIntel(ctx);
  if (!intel) {
    return buildResponse(sessionId, "Connect Shopify to find high-margin bundle pairs.");
  }

  const highMargin = intel.products.filter((p) => p.marginPct >= 30 && p.netProfit > 0);
  const pairs: string[] = [];

  for (const a of highMargin.slice(0, 3)) {
    const partner = highMargin.find(
      (b) => b.productId !== a.productId && b.marginPct >= 25,
    );
    if (partner) {
      pairs.push(
        `• **${a.title} + ${partner.title}** — combined margin ~${Math.round((a.marginPct + partner.marginPct) / 2)}%`,
      );
    }
  }

  if (pairs.length === 0) {
    return buildResponse(sessionId, "Not enough high-margin SKUs to recommend bundles yet.");
  }

  const lines = ["**Bundle candidates:**", ...pairs.slice(0, 3), "", confidenceLine(0.68)];
  return buildResponse(sessionId, lines.join("\n"));
}

export function answerProductsToPromote(ctx: BusinessContext, sessionId: string): AskAiResponse {
  recordTopic(sessionId, "product_promote");
  const intel = requireIntel(ctx);
  if (!intel) {
    return buildResponse(sessionId, "Connect Shopify to get weekly promotion picks.");
  }

  const picks = [
    ...intel.heroes,
    ...intel.products.filter((p) =>
      intel.fastestGrowing.some((w) => w.productId === p.productId),
    ),
  ]
    .filter((p, i, arr) => p && arr.findIndex((x) => x?.productId === p.productId) === i)
    .slice(0, 4) as typeof intel.products;

  const lines = ["**Promote this week:**"];
  for (const p of picks) {
    lines.push(
      `• **${p.title}** — ${formatCurrency(p.netProfit)} net profit, ${p.marginPct}% margin${p.heroReason ? ` (${p.heroReason})` : ""}`,
    );
  }
  lines.push("", confidenceLine(0.81));
  return buildResponse(sessionId, lines.join("\n"));
}

export function answerHiddenWinners(ctx: BusinessContext, sessionId: string): AskAiResponse {
  recordTopic(sessionId, "hidden_winners");
  const intel = requireIntel(ctx);
  if (!intel) {
    return buildResponse(sessionId, "Connect Shopify to surface hidden winner SKUs.");
  }

  if (intel.hiddenWinners.length === 0) {
    return buildResponse(sessionId, "No hidden winners detected — top SKUs may already be fully promoted.");
  }

  const lines = ["**Hidden winners — high margin, under-invested:**"];
  for (const p of intel.hiddenWinners) {
    lines.push(
      `• **${p.title}** — ${p.marginPct}% margin, ${formatCurrency(p.netProfit)} net profit, ${formatCurrency(p.adCost)} ad spend`,
    );
    if (p.hiddenWinnerReason) lines.push(`  _${p.hiddenWinnerReason}_`);
  }
  lines.push("", confidenceLine(0.77));
  lines.push("Review scaling options on **Products**.");
  return buildResponse(sessionId, lines.join("\n"));
}
